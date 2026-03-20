/**
 * Maps linuxFxVersion (ARM / Portal) to `az webapp create --runtime`.
 * Values must match `az webapp list-runtimes --os-type linux` (e.g. NODE:20-lts).
 * Node.js majors no longer offered by App Service map to NODE:20-lts.
 */
function normalizeLinuxRuntimeForAzCli(fxVersion) {
  if (!fxVersion || typeof fxVersion !== 'string') {
    return 'NODE:20-lts';
  }
  const raw = fxVersion.trim();
  const pipeIdx = raw.indexOf('|');
  const colonIdx = raw.indexOf(':');
  let idx = pipeIdx;
  if (pipeIdx === -1 || (colonIdx !== -1 && colonIdx < pipeIdx)) {
    idx = colonIdx;
  }
  if (idx === -1) {
    return raw;
  }
  let stack = raw.slice(0, idx).trim().toUpperCase();
  let ver = raw.slice(idx + 1).trim();

  const stackAliases = {
    NODEJS: 'NODE'
  };
  stack = stackAliases[stack] || stack;

  if (stack === 'NODE') {
    const m = ver.match(/^(\d+)/);
    const major = m ? parseInt(m[1], 10) : 0;
    if (major === 24) ver = '24-lts';
    else if (major === 22) ver = '22-lts';
    else if (major === 20) ver = '20-lts';
    else if (major > 0 && major < 20) ver = '20-lts';
    else if (major > 24) ver = '24-lts';
    else if (major === 0) ver = '20-lts';
  }

  return `${stack}:${ver}`;
}

module.exports = { normalizeLinuxRuntimeForAzCli };
