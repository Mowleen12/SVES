/* ═══════════════════════════════════════════════════════════════
   SVES — AR Navigation Scene (Three.js)
   Targets: #ar-container in the main SPA
   ═══════════════════════════════════════════════════════════════ */

const ARScene = (() => {
  let scene, camera, renderer, pods3d = [];
  let theta = 0.4, phi = 1.0, radius = 38;
  let prevMouse = { x: 0, y: 0 };
  let isDragging = false;
  let animRunning = false;

  /* ── helpers ─────────────────────────────────────────────── */

  function createCapsuleMesh(rad, len, mat) {
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 16), mat);
    cyl.castShadow = true;
    g.add(cyl);
    const top = new THREE.Mesh(new THREE.SphereGeometry(rad, 12, 8), mat);
    top.position.y = len / 2;
    top.castShadow = true;
    g.add(top);
    const bot = new THREE.Mesh(new THREE.SphereGeometry(rad, 12, 8), mat);
    bot.position.y = -len / 2;
    bot.castShadow = true;
    g.add(bot);
    g.rotation.z = Math.PI / 2;
    return g;
  }

  /* ── init ────────────────────────────────────────────────── */

  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !window.THREE) return;

    // clear the "Loading 3D scene…" placeholder
    container.innerHTML = '';

    const rect = container.getBoundingClientRect();
    const W = rect.width || container.clientWidth || 800;
    const H = rect.height || container.clientHeight || 500;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000814, 0.018);

    camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 500);
    _updateCameraPos();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000814, 1);

    container.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0x0a1428, 0.9));
    const topLight = new THREE.DirectionalLight(0x4488ff, 0.9);
    topLight.position.set(0, 30, 10);
    topLight.castShadow = true;
    scene.add(topLight);

    const podLights = [
      new THREE.PointLight(0x00F5FF, 3, 20),
      new THREE.PointLight(0x8B5CF6, 2, 15),
      new THREE.PointLight(0xEC4899, 2, 15),
    ];
    podLights.forEach((l, i) => {
      l.position.set(Math.cos((i / 3) * Math.PI * 2) * 8, 3, Math.sin((i / 3) * Math.PI * 2) * 8);
      scene.add(l);
    });

    _buildStadium();
    _buildZones();
    _buildPods();
    _buildGrid();
    _setupControls(renderer.domElement);
    _startLoop(podLights);

    // ResizeObserver handles both window resize and CSS display changes
    // when the user switches to the AR tab
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width && height && camera && renderer) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
          }
        }
      });
      ro.observe(container);
    } else {
      // fallback
      window.addEventListener('resize', () => {
        const r = container.getBoundingClientRect();
        if (!r.width || !r.height) return;
        camera.aspect = r.width / r.height;
        camera.updateProjectionMatrix();
        renderer.setSize(r.width, r.height);
      });
    }
  }

  /* ── builders ────────────────────────────────────────────── */

  function _buildStadium() {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(16, 64),
      new THREE.MeshStandardMaterial({ color: 0x0a1628, roughness: 0.85, metalness: 0.1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const pitch = new THREE.Mesh(
      new THREE.CircleGeometry(6, 64),
      new THREE.MeshStandardMaterial({ color: 0x0d2b1a, roughness: 0.9, emissive: 0x0a1e12, emissiveIntensity: 0.4 })
    );
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.y = 0.01;
    scene.add(pitch);

    for (let t = 0; t < 40; t++) {
      const angle = (t / 40) * Math.PI * 2;
      for (let tier = 0; tier < 3; tier++) {
        const r = 8.5 + tier * 2.5;
        const h = 1.2 + tier * 1.8;
        const w = 1.8 + tier * 0.4;
        const stand = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, 2.2),
          new THREE.MeshStandardMaterial({
            color: t % 10 < 5 ? 0x0d1b2e : 0x0f2040,
            roughness: 0.8, metalness: 0.2
          })
        );
        stand.position.set(Math.cos(angle) * r, h / 2, Math.sin(angle) * r);
        stand.lookAt(0, h / 2, 0);
        stand.castShadow = true;
        scene.add(stand);
      }
    }

    const concourse = new THREE.Mesh(
      new THREE.RingGeometry(16, 19, 64),
      new THREE.MeshStandardMaterial({ color: 0x0a1628, side: THREE.DoubleSide, roughness: 0.9, metalness: 0.1 })
    );
    concourse.rotation.x = -Math.PI / 2;
    concourse.position.y = 0.02;
    scene.add(concourse);

    const guideway = new THREE.Mesh(
      new THREE.TorusGeometry(12, 0.05, 4, 128),
      new THREE.MeshStandardMaterial({ color: 0x8B5CF6, emissive: 0x8B5CF6, emissiveIntensity: 1.5, transparent: true, opacity: 0.4 })
    );
    guideway.rotation.x = -Math.PI / 2;
    guideway.position.y = 1.5;
    scene.add(guideway);

    const roof = new THREE.Mesh(
      new THREE.TorusGeometry(16.5, 1.2, 8, 64),
      new THREE.MeshStandardMaterial({ color: 0x0a1f3d, metalness: 0.8, roughness: 0.3, emissive: 0x00F5FF, emissiveIntensity: 0.08 })
    );
    roof.rotation.x = -Math.PI / 2;
    roof.position.y = 8;
    scene.add(roof);

    const edge = new THREE.Mesh(
      new THREE.TorusGeometry(16.5, 0.08, 8, 128),
      new THREE.MeshStandardMaterial({ color: 0x00F5FF, emissive: 0x00F5FF, emissiveIntensity: 2 })
    );
    edge.rotation.x = -Math.PI / 2;
    edge.position.y = 8;
    scene.add(edge);
  }

  function _buildZones() {
    const zones = [
      { name: 'Alpha', pos: [0, 0, -12], color: 0x00F5FF },
      { name: 'Beta', pos: [12, 0, 0], color: 0x8B5CF6 },
      { name: 'Gamma', pos: [0, 0, 12], color: 0xEC4899 },
      { name: 'Delta', pos: [-12, 0, 0], color: 0xF59E0B },
      { name: 'Omega', pos: [0, 0, 0], color: 0x10B981 },
    ];
    zones.forEach(({ pos, color }) => {
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(2.5, 2.5, 0.08, 32),
        new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.15, emissive: color, emissiveIntensity: 0.6 })
      );
      disc.position.set(...pos);
      scene.add(disc);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.5, 0.06, 8, 64),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5, transparent: true, opacity: 0.8 })
      );
      ring.position.set(pos[0], 0.05, pos[2]);
      ring.rotation.x = -Math.PI / 2;
      scene.add(ring);

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 6, 8),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity: 0.25 })
      );
      beam.position.set(pos[0], 3, pos[2]);
      scene.add(beam);
    });
  }

  function _buildPods() {
    const colors = [0x00F5FF, 0x8B5CF6, 0xEC4899, 0xF59E0B, 0x10B981];
    const positions = [
      [0, -12], [8, -8], [12, 0], [8, 8], [0, 12],
      [-8, 8], [-12, 0], [-8, -8], [4, -6], [6, 4],
      [-4, 6], [-6, -4],
    ];

    positions.forEach(([px, pz], i) => {
      const color = colors[i % colors.length];
      const pod = new THREE.Group();
      const baseY = 1.8 + Math.random() * 2.0;
      pod.position.set(px, baseY, pz);

      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.2 });
      const body = createCapsuleMesh(0.25, 0.45, bodyMat);
      pod.add(body);

      const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x050a12, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.85 });
      const cockpit = createCapsuleMesh(0.18, 0.25, cockpitMat);
      cockpit.position.set(0.1, 0.12, 0);
      pod.add(cockpit);

      const accent = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.05, 0.52),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5 })
      );
      accent.position.set(0, -0.05, 0);
      pod.add(accent);

      const thrusterMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.5 });
      for (let j = -1; j <= 1; j += 2) {
        const thruster = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 8, 16), thrusterMat);
        thruster.rotation.y = Math.PI / 2;
        thruster.position.set(-0.45, 0, j * 0.12);
        pod.add(thruster);
      }

      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 0.35, 16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = -0.25;
      pod.add(halo);

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.4, baseY, 16, 1, true),
        new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.1, emissive: color, emissiveIntensity: 0.3, side: THREE.DoubleSide })
      );
      beam.position.y = -baseY / 2;
      pod.add(beam);

      pod.userData = {
        baseY,
        floatSpeed: 0.8 + Math.random() * 1.5,
        floatAmp: 0.15 + Math.random() * 0.2,
        orbitR: Math.sqrt(px * px + pz * pz),
        orbitAngle: Math.atan2(pz, px),
        orbitSpeed: (0.0015 + Math.random() * 0.002) * (Math.random() > 0.5 ? 1 : -1),
        color,
      };

      scene.add(pod);
      pods3d.push(pod);
    });
  }

  function _buildGrid() {
    const g = new THREE.GridHelper(34, 34, 0x0a2040, 0x051020);
    g.position.y = -0.01;
    scene.add(g);
  }

  /* ── controls ────────────────────────────────────────────── */

  function _setupControls(el) {
    el.style.touchAction = 'none';

    el.addEventListener('mousedown', e => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      theta -= (e.clientX - prevMouse.x) * 0.005;
      phi -= (e.clientY - prevMouse.y) * 0.005;
      phi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, phi));
      prevMouse = { x: e.clientX, y: e.clientY };
    });

    el.addEventListener('wheel', e => {
      radius += e.deltaY * 0.04;
      radius = Math.max(14, Math.min(65, radius));
      e.preventDefault();
    }, { passive: false });

    let lastTouchDist = null;
    el.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    });
    el.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging) {
        theta -= (e.touches[0].clientX - prevMouse.x) * 0.005;
        phi -= (e.touches[0].clientY - prevMouse.y) * 0.005;
        phi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, phi));
        prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastTouchDist) radius += (lastTouchDist - dist) * 0.05;
        lastTouchDist = dist;
        radius = Math.max(14, Math.min(65, radius));
      }
    }, { passive: false });
    el.addEventListener('touchend', () => { isDragging = false; lastTouchDist = null; });
  }

  function _updateCameraPos() {
    if (!camera) return;
    camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
    camera.position.y = radius * Math.cos(phi);
    camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(0, 1, 0);
  }

  function _startLoop(podLights) {
    if (!renderer || animRunning) return;
    animRunning = true;
    const tick = () => {
      if (!animRunning) return;
      const t = Date.now() * 0.001;

      pods3d.forEach((pod, i) => {
        const ud = pod.userData;
        ud.orbitAngle += ud.orbitSpeed;
        const r = ud.orbitR + Math.sin(t * 0.3 + i) * 0.4;
        pod.position.x = Math.cos(ud.orbitAngle) * r;
        pod.position.z = Math.sin(ud.orbitAngle) * r;
        pod.position.y = ud.baseY + Math.sin(t * ud.floatSpeed + i) * ud.floatAmp;
        pod.rotation.y += 0.01;
      });

      podLights.forEach((l, i) => {
        const angle = t * 0.4 + (i / 3) * Math.PI * 2;
        l.position.x = Math.cos(angle) * 9;
        l.position.z = Math.sin(angle) * 9;
        l.intensity = 2 + Math.sin(t * 2 + i) * 0.8;
      });

      _updateCameraPos();
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ── public API ──────────────────────────────────────────── */

  return {
    init,
    focusZone(name) {
      const angles = { Alpha: 0, Beta: Math.PI / 2, Gamma: Math.PI, Delta: -Math.PI / 2, Omega: 0 };
      theta = angles[name] || 0;
      phi = 0.7;
      radius = 22;
    },
    resetCamera() { theta = 0.4; phi = 1.0; radius = 38; },
    topView() { phi = 0.15; radius = 45; },
    sideView() { phi = 1.4; radius = 35; },
  };
})();

/* ── boot ──────────────────────────────────────────────────── */

(function boot() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ARScene.init('ar-container'));
  } else {
    ARScene.init('ar-container');
  }
})();