
// HyperShield front-end demonstration. This does NOT create a VPN or proxy.
(() => {
  const toggle = document.getElementById('shieldToggle');
  const status = document.getElementById('shieldStatus');
  const title = document.getElementById('shieldConnectionTitle');
  const locationSelect = document.getElementById('shieldLocation');
  const locationStatus = document.getElementById('shieldLocationStatus');
  if (!toggle || !status || !title || !locationSelect || !locationStatus) return;
  let demoOn = false;
  const locations = {
    auto: 'Smart location selected for demo only.',
    'us-east': 'United States · East selected for demo only.',
    'us-west': 'United States · West selected for demo only.',
    uk: 'United Kingdom selected for demo only.',
    jp: 'Japan selected for demo only.',
    de: 'Germany selected for demo only.'
  };
  toggle.addEventListener('click', () => {
    demoOn = !demoOn;
    toggle.setAttribute('aria-pressed', String(demoOn));
    toggle.classList.toggle('demo-on', demoOn);
    toggle.textContent = demoOn ? '⏻ Turn off demo mode' : '⚡ Enable demo mode';
    title.textContent = demoOn ? 'Demo mode enabled' : 'Not connected';
    status.textContent = demoOn ? 'Demo mode · Traffic is NOT protected' : 'Demo mode · No VPN connection';
  });
  locationSelect.addEventListener('change', () => {
    locationStatus.textContent = locations[locationSelect.value] || 'Demo selection only.';
  });
})();
