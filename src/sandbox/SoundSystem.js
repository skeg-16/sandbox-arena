class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  _initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  // ═══ UI SOUND CUES ═══

  playUIClick() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  playUIHover() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }

  playBattleHorn() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    // Deep war horn sound
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(110, this.ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(130, this.ctx.currentTime + 0.8);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc2.frequency.linearRampToValueAtTime(260, this.ctx.currentTime + 0.8);

    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 1.2);
    osc2.stop(this.ctx.currentTime + 1.2);
  }

  // ═══ COMBAT SOUNDS ═══

  playSwordSlash() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playBluntHit() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playFireballExplosion() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    // Noise buffer for blast
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.4);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }

  playArrowRelease() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playRagdollSqueak() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const startFreq = 300 + Math.random() * 400;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 0.3, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playVictoryFanfare() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    // Epic medieval fanfare — two-part brass + timpani
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = idx < 3 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.15);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.15 + 0.7);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(this.ctx.currentTime + idx * 0.15);
      osc.stop(this.ctx.currentTime + idx * 0.15 + 0.7);
    });

    // Add a timpani hit at the start
    const timpani = this.ctx.createOscillator();
    const timpGain = this.ctx.createGain();
    timpani.type = 'sine';
    timpani.frequency.setValueAtTime(80, this.ctx.currentTime);
    timpani.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.4);
    timpGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    timpGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    timpani.connect(timpGain);
    timpGain.connect(this.ctx.destination);
    timpani.start();
    timpani.stop(this.ctx.currentTime + 0.4);
  }

  playComboFinisher() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    // Resonant martial arts impact + rising power tone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(360, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  playUltimate() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    // Colossal power surge fanfare
    const freqs = [180, 270, 360, 540];
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, this.ctx.currentTime + i * 0.05);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.05 + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + i * 0.05);
      osc.stop(this.ctx.currentTime + i * 0.05 + 0.5);
    });
  }

  playHeavyWoodBreak() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    // Heavy splintering wood crunch + low thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playTowerCollapse() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    // Sub-bass earthquake rumble + tumbling masonry stones
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(75, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.8);

    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.9);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.9);
  }

  // ═══ DEITY & BOSS AUDIO EFFECTS ═══

  playDivineThunder() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    // 1. Sharp electric crack
    const crackOsc = this.ctx.createOscillator();
    const crackGain = this.ctx.createGain();
    crackOsc.type = 'sawtooth';
    crackOsc.frequency.setValueAtTime(1400, this.ctx.currentTime);
    crackOsc.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + 0.15);
    crackGain.gain.setValueAtTime(0.6, this.ctx.currentTime);
    crackGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    crackOsc.connect(crackGain);
    crackGain.connect(this.ctx.destination);
    crackOsc.start();
    crackOsc.stop(this.ctx.currentTime + 0.2);

    // 2. Rolling sub-bass thunder rumble
    const rumbleOsc = this.ctx.createOscillator();
    const rumbleGain = this.ctx.createGain();
    rumbleOsc.type = 'triangle';
    rumbleOsc.frequency.setValueAtTime(95, this.ctx.currentTime + 0.05);
    rumbleOsc.frequency.linearRampToValueAtTime(28, this.ctx.currentTime + 1.2);
    rumbleGain.gain.setValueAtTime(0.5, this.ctx.currentTime + 0.05);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.3);
    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(this.ctx.destination);
    rumbleOsc.start(this.ctx.currentTime + 0.05);
    rumbleOsc.stop(this.ctx.currentTime + 1.3);
  }

  playWarGodRoar() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    // Guttural demonic war shout with distortion
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(90, this.ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(145, this.ctx.currentTime + 0.3);
    osc1.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.9);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(45, this.ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.9);

    gain.gain.setValueAtTime(0.45, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.9);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 0.9);
    osc2.stop(this.ctx.currentTime + 0.9);
  }

  playSoulSiphon() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    // Resonant spectral sine chime glide
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(260, this.ctx.currentTime + 0.4);
    osc.frequency.linearRampToValueAtTime(130, this.ctx.currentTime + 0.8);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.8);
  }

  playTidalCrash() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    // Deep surging water crash
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.7);

    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.7);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.7);
  }

  playBossEnrage() {
    if (this.muted) return;
    this._initCtx();
    if (!this.ctx) return;

    // Ominous low brass fanfare drone
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(65, this.ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(82.4, this.ctx.currentTime + 0.6); // E2

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(130, this.ctx.currentTime);
    osc2.frequency.linearRampToValueAtTime(164.8, this.ctx.currentTime + 0.6); // E3

    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 1.5);
    osc2.stop(this.ctx.currentTime + 1.5);
  }
}

export const soundSystem = new SoundSynthesizer();
