/**
 * Gold Client — JVM Optimizer
 *
 * ORDERING RULES (critical — Java processes flags left to right):
 *   1. -XX:+UnlockExperimentalVMOptions  ← MUST be first
 *   2. -XX:+UnlockDiagnosticVMOptions    ← MUST be before diagnostic flags
 *   3. Metaspace
 *   4. GC flags  (use experimental options)
 *   5. Base flags
 *   6. Diagnostic flags
 *   7. Performance / threading flags
 *   8. User extra args
 *
 * Java version compatibility:
 *   -XX:-UseBiasedLocking  was deprecated in Java 9 and REMOVED in Java 15.
 *   Using it on Java 15+ prints "Unrecognized VM option" and exits fatally.
 *   → We never include it.
 */

const BASE_FLAGS = [
  '-XX:+DisableExplicitGC',           // Block System.gc() calls — #1 lag spike source
  '-XX:+AlwaysPreTouch',              // Pre-touch heap pages at startup — no alloc stalls
  '-XX:+UseStringDeduplication',      // Deduplicate identical String objects
  '-XX:+OptimizeStringConcat',
  '-XX:+UseCompressedOops',
  // NOTE: -XX:-UseBiasedLocking is intentionally omitted.
  // It was removed in Java 15 and causes a fatal "Unrecognized VM option" on Java 21+.
  '-Dfml.ignorePatchDiscrepancies=true',
  '-Dfml.ignoreInvalidMinecraftCertificates=true',
  '-Dlog4j2.formatMsgNoLookups=true', // Log4Shell CVE-2021-44228 mitigation
];

const DIAGNOSTIC_FLAGS = [
  '-XX:+UseFastUnorderedTimeStamps',
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
  return ['-XX:+UseZGC', '-XX:+ZUncommit', '-XX:ZUncommitDelay=300'];
}

function getShenandoahFlags() {
  return ['-XX:+UseShenandoahGC', '-XX:ShenandoahGCMode=iu'];
}

/**
 * Build the complete JVM argument list.
 *
 * @param {object}  opts
 * @param {number}  opts.ramMB          - Heap size in MB
 * @param {boolean} opts.performance    - Enable perf flags (default true)
 * @param {string}  opts.gcMode        - 'auto'|'g1gc'|'zgc'|'shenandoah'
 * @param {string}  opts.javaVersion   - Major Java version string e.g. '17'
 * @param {string}  opts.extraArgs     - Raw user JVM arg string
 * @param {boolean} opts.includeMemory - Include -Xms/-Xmx (default true).
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
    includeMemory = true,
  } = opts;

  const args = [];

  // Step 1: Unlock flags — MUST be first
  args.push('-XX:+UnlockExperimentalVMOptions');
  args.push('-XX:+UnlockDiagnosticVMOptions');

  // Step 2: Memory (skip when MCLC manages it via options.memory)
  if (includeMemory) {
    args.push(`-Xms${ramMB}M`, `-Xmx${ramMB}M`);
  }

  // Step 3: Metaspace
  args.push(
    '-XX:MetaspaceSize=256M',
    `-XX:MaxMetaspaceSize=${Math.min(512, Math.floor(ramMB * 0.1))}M`
  );

  // Step 4: GC flags (after UnlockExperimentalVMOptions)
  const jvInt = parseInt(javaVersion, 10);
  const gc    = gcMode === 'auto'
    ? (ramMB >= 8000 && jvInt >= 15 ? 'zgc' : 'g1gc')
    : gcMode;

  if      (gc === 'zgc')        args.push(...getZGCFlags());
  else if (gc === 'shenandoah') args.push(...getShenandoahFlags());
  else                          args.push(...getAikarG1Flags(ramMB));

  // Step 5: Base flags
  args.push(...BASE_FLAGS);

  // Step 6: Diagnostic flags (after UnlockDiagnosticVMOptions)
  args.push(...DIAGNOSTIC_FLAGS);

  // Step 7: Performance flags
  if (performance) {
    args.push(
      '-XX:+UseNUMA',
      ...RENDER_FLAGS,
      ...NETWORK_FLAGS,
    );
    const cache = Math.min(512, Math.max(128, Math.floor(ramMB * 0.1)));
    args.push(
      `-XX:ReservedCodeCacheSize=${cache}M`,
      '-XX:+UseCodeCacheFlushing',
      '-XX:+ParallelRefProcEnabled',
      '-XX:ConcGCThreads=2',
      '-XX:ParallelGCThreads=4',
    );
  }

  // Step 8: User extra args
  if (extraArgs && extraArgs.trim()) {
    args.push(...extraArgs.trim().split(/\s+/).filter(Boolean));
  }

  return args;
}

function getJvmFlagExplanations() {
  return {
    '-XX:+UnlockExperimentalVMOptions': 'Must be FIRST. Enables experimental flags like G1NewSizePercent.',
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
