/**
 * Gold Client — JVM Optimizer
 *
 * Generates optimised JVM arguments for maximum Minecraft FPS.
 * Based on Aikar's flags + GC tuning research.
 *
 * IMPORTANT: The 'includeMemory' option (default true) controls whether
 * -Xms / -Xmx are included in the output array.
 * Set includeMemory: false when using MCLC's built-in memory option,
 * because MCLC generates -Xms/-Xmx from options.memory itself.
 * Having duplicate memory flags leads to confusing JVM behavior.
 */

const BASE_FLAGS = [
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:+UnlockDiagnosticVMOptions',
  '-XX:+DisableExplicitGC',           // Block mods calling System.gc() — #1 lag spike cause
  '-XX:+AlwaysPreTouch',              // Pre-touch heap pages on start — no allocation stalls
  '-XX:+UseNUMA',                     // NUMA-aware memory on multi-CPU systems
  '-XX:+UseFastUnorderedTimeStamps',
  '-XX:+UseStringDeduplication',      // Reduce duplicate String heap pressure
  '-XX:+OptimizeStringConcat',
  '-XX:+UseCompressedOops',
  '-XX:-UseBiasedLocking',
  '-Dfml.ignorePatchDiscrepancies=true',
  '-Dfml.ignoreInvalidMinecraftCertificates=true',
  '-Dlog4j2.formatMsgNoLookups=true', // Log4Shell CVE-2021-44228 mitigation
];

const RENDER_FLAGS  = ['-XX:+UseThreadPriorities', '-XX:ThreadPriorityPolicy=1'];
const NETWORK_FLAGS = ['-Djava.net.preferIPv4Stack=true', '-Dnetworkaddress.cache.ttl=60'];

function getAikarG1Flags(heapMB) {
  const regionSize = heapMB >= 12000 ? 32 : heapMB >= 6000 ? 16 : heapMB >= 3000 ? 8 : 4;
  return [
    '-XX:+UseG1GC',
    `-XX:G1HeapRegionSize=${regionSize}M`,
    '-XX:G1NewSizePercent=30',
    '-XX:G1MaxNewSizePercent=40',
    '-XX:G1HeapWastePercent=5',
    '-XX:G1MixedGCCountTarget=4',
    '-XX:InitiatingHeapOccupancyPercent=15',
    '-XX:G1MixedGCLiveThresholdPercent=90',
    '-XX:G1RSetUpdatingPauseTimePercent=5',
    '-XX:SurvivorRatio=32',
    '-XX:+PerfDisableSharedMem',
    '-XX:MaxTenuringThreshold=1',
    '-XX:MaxGCPauseMillis=200',
  ];
}

function getZGCFlags() {
  return ['-XX:+UseZGC', '-XX:+ZUncommit', '-XX:ZUncommitDelay=300', '-XX:+ZProactive'];
}

function getShenandoahFlags() {
  return ['-XX:+UseShenandoahGC', '-XX:ShenandoahGCMode=iu', '-XX:ShenandoahGuaranteedGCInterval=1000'];
}

/**
 * Build the complete JVM argument list.
 *
 * @param {object}  opts
 * @param {number}  opts.ramMB          - Heap size in megabytes
 * @param {boolean} opts.performance    - Enable perf flags (default true)
 * @param {string}  opts.gcMode        - 'auto' | 'g1gc' | 'zgc' | 'shenandoah'
 * @param {string}  opts.javaVersion   - Major Java version string (e.g. '17')
 * @param {string}  opts.extraArgs     - User-defined raw JVM arg string
 * @param {boolean} opts.includeMemory - Include -Xms / -Xmx (default TRUE)
 *                                       Set FALSE when using MCLC's memory option.
 * @returns {string[]}
 */
function buildJvmArgs(opts = {}) {
  const {
    ramMB         = 2048,
    performance   = true,
    gcMode        = 'auto',
    javaVersion   = '17',
    extraArgs     = '',
    includeMemory = true,   // <── new param
  } = opts;

  const args = [];

  // Memory flags — only when MCLC is NOT managing them
  if (includeMemory) {
    args.push(`-Xms${ramMB}M`, `-Xmx${ramMB}M`);
  }

  // Metaspace
  args.push('-XX:MetaspaceSize=256M', `-XX:MaxMetaspaceSize=${Math.min(512, Math.floor(ramMB * 0.1))}M`);

  // GC selection
  const jvInt = parseInt(javaVersion, 10);
  const gc    = gcMode === 'auto' ? (ramMB >= 8000 && jvInt >= 15 ? 'zgc' : 'g1gc') : gcMode;
  if (gc === 'zgc')           args.push(...getZGCFlags());
  else if (gc === 'shenandoah') args.push(...getShenandoahFlags());
  else                          args.push(...getAikarG1Flags(ramMB));

  args.push(...BASE_FLAGS);

  if (performance) {
    args.push(...RENDER_FLAGS, ...NETWORK_FLAGS);
    const cache = Math.min(512, Math.max(128, Math.floor(ramMB * 0.1)));
    args.push(`-XX:ReservedCodeCacheSize=${cache}M`, '-XX:+UseCodeCacheFlushing');
    args.push('-XX:+ParallelRefProcEnabled', '-XX:ConcGCThreads=2', '-XX:ParallelGCThreads=4');
  }

  if (extraArgs && extraArgs.trim()) {
    args.push(...extraArgs.trim().split(/\s+/).filter(Boolean));
  }

  return args;
}

function getJvmFlagExplanations() {
  return {
    '-Xms / -Xmx':              'Min/max heap. Set equal to prevent GC resize pauses.',
    '-XX:+UseG1GC':             'G1 GC — best for 2–8 GB allocations.',
    '-XX:+UseZGC':              'Z GC — sub-ms pauses, ideal for 8 GB+.',
    '-XX:G1HeapRegionSize':     'Larger regions = less GC overhead on big heaps.',
    '-XX:+AlwaysPreTouch':      'Pre-allocates pages: no stall on first access.',
    '-XX:+DisableExplicitGC':   'Blocks System.gc() — the #1 mod-caused lag spike.',
    '-XX:+UseStringDeduplication': 'Removes duplicate String objects to reduce heap.',
    '-XX:+ParallelRefProcEnabled': 'Parallel ref processing = shorter GC pauses.',
    '-XX:ReservedCodeCacheSize': 'JIT code cache. More = fewer re-compilations.',
    '-Dlog4j2.formatMsgNoLookups': 'Log4Shell security fix (CVE-2021-44228).',
  };
}

function suggestRam(totalRamMB) {
  if (totalRamMB >= 32000) return 8192;
  if (totalRamMB >= 16000) return 6144;
  if (totalRamMB >= 8000)  return 4096;
  if (totalRamMB >= 4000)  return 2560;
  return 2048;
}

module.exports = { buildJvmArgs, suggestRam, getJvmFlagExplanations };
