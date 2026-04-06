/**
 * Gold Client - JVM Optimizer
 *
 * Generates carefully tuned JVM arguments for maximum Minecraft FPS.
 * References:
 *  - https://aikar.co/mcflags.html
 *  - https://docs.oracle.com/en/java/javase/17/gctuning/
 */

const BASE_FLAGS = [
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:+UnlockDiagnosticVMOptions',
  '-XX:+DisableExplicitGC',          // Block mods from calling System.gc() — huge lag spikes
  '-XX:+AlwaysPreTouch',             // Pre-touch heap pages on start — no allocation stalls
  '-XX:+UseNUMA',                    // NUMA-aware memory on multi-CPU systems
  '-XX:+UseFastUnorderedTimeStamps',
  '-XX:+UseStringDeduplication',     // Dedup identical Strings — reduces heap pressure
  '-XX:+OptimizeStringConcat',
  '-XX:+UseCompressedOops',
  '-XX:-UseBiasedLocking',
  '-Dfml.ignorePatchDiscrepancies=true',
  '-Dfml.ignoreInvalidMinecraftCertificates=true',
  '-Dlog4j2.formatMsgNoLookups=true',  // Log4Shell CVE-2021-44228 mitigation
];

const RENDER_FLAGS = [
  '-XX:+UseThreadPriorities',
  '-XX:ThreadPriorityPolicy=1',
];

const NETWORK_FLAGS = [
  '-Djava.net.preferIPv4Stack=true',
  '-Dnetworkaddress.cache.ttl=60',
];

/** Aikar's G1GC flags — gold standard for Minecraft (2–8 GB RAM). */
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

/** ZGC flags — ultra-low latency for Java 15+, best with 8 GB+ RAM. */
function getZGCFlags() {
  return ['-XX:+UseZGC', '-XX:+ZUncommit', '-XX:ZUncommitDelay=300', '-XX:+ZProactive'];
}

/** ShenandoahGC — alternative low-pause GC. */
function getShenandoahFlags() {
  return ['-XX:+UseShenandoahGC', '-XX:ShenandoahGCMode=iu', '-XX:ShenandoahGuaranteedGCInterval=1000'];
}

/**
 * Build the complete optimized JVM argument list.
 * @param {object} opts
 * @param {number}  opts.ramMB       - Heap size in MB (Xms = Xmx = ramMB to avoid resize pauses)
 * @param {boolean} opts.performance - Apply extra render/network flags
 * @param {string}  opts.gcMode     - 'auto' | 'g1gc' | 'zgc' | 'shenandoah'
 * @param {string}  opts.extraArgs  - Raw user JVM args string
 * @returns {string[]}
 */
function buildJvmArgs(opts = {}) {
  const { ramMB = 2048, performance = true, gcMode = 'auto', javaVersion = '17', extraArgs = '' } = opts;
  const args = [];

  // Memory — Xms == Xmx prevents costly heap resize pauses during gameplay
  args.push(`-Xms${ramMB}M`, `-Xmx${ramMB}M`);
  args.push('-XX:MetaspaceSize=256M', `-XX:MaxMetaspaceSize=${Math.min(512, Math.floor(ramMB * 0.1))}M`);

  // GC selection
  const jvInt = parseInt(javaVersion, 10);
  const gc = gcMode === 'auto' ? (ramMB >= 8000 && jvInt >= 15 ? 'zgc' : 'g1gc') : gcMode;
  if (gc === 'zgc') args.push(...getZGCFlags());
  else if (gc === 'shenandoah') args.push(...getShenandoahFlags());
  else args.push(...getAikarG1Flags(ramMB));

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
    '-Xms / -Xmx':              'Heap min = max. Prevents GC resize pauses mid-game.',
    '-XX:+UseG1GC':             'G1 GC — best balance for 2–8 GB allocations.',
    '-XX:+UseZGC':              'Z GC — sub-millisecond pauses for 8 GB+ allocations.',
    '-XX:G1HeapRegionSize':     'Larger regions = less GC overhead on big heaps.',
    '-XX:+AlwaysPreTouch':      'Pre-allocates pages so no stall on first access.',
    '-XX:+DisableExplicitGC':   'Blocks System.gc() calls — the #1 lag spike source in mods.',
    '-XX:+UseStringDeduplication': 'Removes duplicate String objects, reducing heap.',
    '-XX:+ParallelRefProcEnabled': 'Parallel ref processing — shorter GC pauses.',
    '-XX:ReservedCodeCacheSize': 'JIT code cache. Larger = fewer re-compilations.',
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
