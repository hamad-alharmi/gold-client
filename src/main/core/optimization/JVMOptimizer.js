/**
 * Gold Client — JVM Optimizer (v3)
 *
 * CRITICAL FIX: -XX:+UnlockExperimentalVMOptions MUST be the very first
 * argument in the JVM args array. Java processes flags left-to-right and
 * rejects any experimental flag (like G1NewSizePercent) that appears before
 * the unlock flag, with a fatal error.
 *
 * Rule: UNLOCK FLAGS → MEMORY → GC FLAGS → BASE FLAGS → PERF FLAGS → USER FLAGS
 */

// Flags that do NOT require -XX:+UnlockExperimentalVMOptions
const BASE_FLAGS = [
  '-XX:+DisableExplicitGC',           // Block mods calling System.gc() — #1 lag spike cause
  '-XX:+AlwaysPreTouch',              // Pre-touch heap pages on start — no allocation stalls
  '-XX:+UseStringDeduplication',      // Reduce duplicate String heap pressure
  '-XX:+OptimizeStringConcat',
  '-XX:+UseCompressedOops',
  '-XX:-UseBiasedLocking',
  '-Dfml.ignorePatchDiscrepancies=true',
  '-Dfml.ignoreInvalidMinecraftCertificates=true',
  '-Dlog4j2.formatMsgNoLookups=true', // Log4Shell CVE-2021-44228 mitigation
];

// Flags that require -XX:+UnlockDiagnosticVMOptions
const DIAGNOSTIC_FLAGS = [
  '-XX:+UseFastUnorderedTimeStamps',
];

const RENDER_FLAGS  = ['-XX:+UseThreadPriorities', '-XX:ThreadPriorityPolicy=1'];
const NETWORK_FLAGS = ['-Djava.net.preferIPv4Stack=true', '-Dnetworkaddress.cache.ttl=60'];

/**
 * Aikar's G1GC flags.
 * These use experimental JVM options — UnlockExperimentalVMOptions MUST
 * precede ALL of these in the final args array.
 */
function getAikarG1Flags(heapMB) {
  const regionSize = heapMB >= 12000 ? 32 : heapMB >= 6000 ? 16 : heapMB >= 3000 ? 8 : 4;
  return [
    '-XX:+UseG1GC',
    `-XX:G1HeapRegionSize=${regionSize}M`,
    '-XX:G1NewSizePercent=30',          // experimental
    '-XX:G1MaxNewSizePercent=40',       // experimental
    '-XX:G1HeapWastePercent=5',
    '-XX:G1MixedGCCountTarget=4',
    '-XX:InitiatingHeapOccupancyPercent=15',
    '-XX:G1MixedGCLiveThresholdPercent=90', // experimental
    '-XX:G1RSetUpdatingPauseTimePercent=5',
    '-XX:SurvivorRatio=32',
    '-XX:+PerfDisableSharedMem',
    '-XX:MaxTenuringThreshold=1',
    '-XX:MaxGCPauseMillis=200',
  ];
}

function getZGCFlags() {
  // ZGC itself is experimental on Java 15-17 but standard on Java 21
  return ['-XX:+UseZGC', '-XX:+ZUncommit', '-XX:ZUncommitDelay=300'];
}

function getShenandoahFlags() {
  return ['-XX:+UseShenandoahGC', '-XX:ShenandoahGCMode=iu'];
}

/**
 * Build the complete JVM argument list.
 *
 * ORDERING (critical):
 *   1. -XX:+UnlockExperimentalVMOptions   ← MUST be first
 *   2. -XX:+UnlockDiagnosticVMOptions     ← MUST be before diagnostic flags
 *   3. Metaspace sizing
 *   4. GC flags (use experimental options)
 *   5. Base safety/compat flags
 *   6. Diagnostic flags (use diagnostic options)
 *   7. Performance flags
 *   8. User extra args
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

  // ── Step 1: UNLOCK FLAGS — must be absolute first ──────────────────────────
  // Without these preceding all other flags, Java will refuse to start with:
  // "VM option 'G1NewSizePercent' is experimental and must be enabled via
  //  -XX:+UnlockExperimentalVMOptions"
  args.push('-XX:+UnlockExperimentalVMOptions');
  args.push('-XX:+UnlockDiagnosticVMOptions');

  // ── Step 2: Memory (only when not using MCLC's built-in memory option) ─────
  if (includeMemory) {
    args.push(`-Xms${ramMB}M`, `-Xmx${ramMB}M`);
  }

  // ── Step 3: Metaspace ───────────────────────────────────────────────────────
  args.push(
    '-XX:MetaspaceSize=256M',
    `-XX:MaxMetaspaceSize=${Math.min(512, Math.floor(ramMB * 0.1))}M`
  );

  // ── Step 4: GC flags (require UnlockExperimentalVMOptions above) ───────────
  const jvInt = parseInt(javaVersion, 10);
  const gc    = gcMode === 'auto'
    ? (ramMB >= 8000 && jvInt >= 15 ? 'zgc' : 'g1gc')
    : gcMode;

  if      (gc === 'zgc')         args.push(...getZGCFlags());
  else if (gc === 'shenandoah')  args.push(...getShenandoahFlags());
  else                           args.push(...getAikarG1Flags(ramMB));

  // ── Step 5: Base flags ──────────────────────────────────────────────────────
  args.push(...BASE_FLAGS);

  // ── Step 6: Diagnostic flags (require UnlockDiagnosticVMOptions) ───────────
  args.push(...DIAGNOSTIC_FLAGS);

  // ── Step 7: Performance flags ───────────────────────────────────────────────
  if (performance) {
    args.push(
      '-XX:+UseNUMA',           // NUMA-aware memory (also needs UnlockExperimental on some JVMs)
      ...RENDER_FLAGS,
      ...NETWORK_FLAGS,
    );
    const cache = Math.min(512, Math.max(128, Math.floor(ramMB * 0.1)));
    args.push(
      `-XX:ReservedCodeCacheSize=${cache}M`,
      '-XX:+UseCodeCacheFlushing',
      '-XX:+ParallelRefProcEnabled',
      '-XX:ConcGCThreads=2',
      '-XX:ParallelGCThreads=4'
    );
  }

  // ── Step 8: User-defined extra args ────────────────────────────────────────
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
