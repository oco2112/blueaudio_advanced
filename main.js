var audioCtx;
var sine_enabled = true;

//starting with sine wave
var currentWaveform = 'sine';

//starting with additive method
var currentMethod = "default";

//starting with LFO enabled set to false
let lfo_enabled = false;
//value of lfo frequency
let lfo_frequency = 1;
//depth of lfo
let lfo_depth = 10;

//setting ASDR values of gain node
const attackTime = 0.3;
const decayTime = 0.05;
const attackLevel = 0.2;
const sustainLevel = 0.5;
let releaseTime = 0.3;

//pitch 
let pitch = 1;

//number partials (additive synthesis only)
let num_partials = 5;

//sphere
let sphere = document.querySelector('.sphere');
let activeNotesCount = 0;


//initialize audio context
document.addEventListener("DOMContentLoaded", function (event) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)

    //this will control the volume of all notes
    globalGain = audioCtx.createGain();
    globalGain.gain.setValueAtTime(0.6, audioCtx.currentTime);
    globalGain.connect(audioCtx.destination);

});

//map keyboard frequencies 
const keyboardFrequencyMap = {
    '90': 261.625565300598634,  //Z - C
    '83': 277.182630976872096, //S - C#
    '88': 293.664767917407560,  //X - D
    '68': 311.126983722080910, //D - D#
    '67': 329.627556912869929,  //C - E
    '86': 349.228231433003884,  //V - F
    '71': 369.994422711634398, //G - F#
    '66': 391.995435981749294,  //B - G
    '72': 415.304697579945138, //H - G#
    '78': 440.000000000000000,  //N - A
    '74': 466.163761518089916, //J - A#
    '77': 493.883301256124111,  //M - B
    '81': 523.251130601197269,  //Q - C
    '50': 554.365261953744192, //2 - C#
    '87': 587.329535834815120,  //W - D
    '51': 622.253967444161821, //3 - D#
    '69': 659.255113825739859,  //E - E
    '82': 698.456462866007768,  //R - F
    '53': 739.988845423268797, //5 - F#
    '84': 783.990871963498588,  //T - G
    '54': 830.609395159890277, //6 - G#
    '89': 880.000000000000000,  //Y - A
    '55': 932.327523036179832, //7 - A#
    '85': 987.766602512248223,  //U - B
}

//add listeners to keys
window.addEventListener('keydown', keyDown, false);
window.addEventListener('keyup', keyUp, false);

activeOscillators = {}

function keyDown(event) {
    const key = (event.detail || event.which).toString();
    if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
        playNote(key);
    }
}

function keyUp(event) {
    const key = (event.detail || event.which).toString();
    if (keyboardFrequencyMap[key] && activeOscillators[key]) {
        releaseNote(activeOscillators[key]);
        delete activeOscillators[key];
    }


}

function releaseNote(note) {

    // const { osc, gainNode } = note;

    // refining release phase using the releaseTime 
    const releaseStartTime = audioCtx.currentTime;
    const releaseEndTime = releaseStartTime + releaseTime;

    note[1].gain.setValueAtTime(note[1].gain.value, audioCtx.currentTime);
    note[1].gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + releaseTime);

    // stop oscillator after the release phase
    note[0].stop(releaseEndTime);

    activeNotesCount--;
    updateSphere();
}



//playing note 
function playNote(key) {

    //new audioCtx
    audioCtx = new (window.AudioContext || window.webkitAudioContext)
    //you will need a new gain node for each node to control the adsr of that note
    const gainNode = audioCtx.createGain();

    //optional lfo settings
    var lfo = audioCtx.createOscillator();
    lfo.frequency.value = lfo_frequency;
    lfoGain = audioCtx.createGain();
    lfoGain.gain.value = lfo_depth;

    if (currentMethod == "additive") {

        gainNode.gain.value = 0.00001;

        //creating an array to hold the partials
        let partials = [];

        //looping over partials
        for (let i = 0; i < num_partials; i++) {
            //create partial oscillator
            let osc = audioCtx.createOscillator();
            //set frequency
            osc.frequency.setValueAtTime(((i * keyboardFrequencyMap[key]) + (i - 1) * Math.random() * 15) * pitch, audioCtx.currentTime);
            //set type
            osc.type = currentWaveform;
            //connect to global gain
            osc.connect(gainNode);
            //start oscillator
            osc.start();
            //store oscillator
            partials[i] = osc;
            //add both the osc and its respective gainNode to list
            activeOscillators[key] = [osc, gainNode];
        }

        //connect globalGain to audioCtx.destination
        gainNode.connect(audioCtx.destination);

        //gain envelope
        gainNode.gain.setTargetAtTime(0.25, audioCtx.currentTime, 0.05);
        gainNode.gain.setTargetAtTime(0.0001, audioCtx.currentTime + 0.2, 1);

    }
    else if (currentMethod == "AM") {
        const carrier = audioCtx.createOscillator();
        const modulatorFreq = audioCtx.createOscillator();

        modulatorFreq.frequency.setValueAtTime(keyboardFrequencyMap[key] * pitch, audioCtx.currentTime);
        carrier.frequency.setValueAtTime((keyboardFrequencyMap[key] + 340) * pitch, audioCtx.currentTime);

        carrier.type = currentWaveform;
        modulatorFreq.type = currentWaveform;

        carrier.start();
        modulatorFreq.start();

        const modulated = audioCtx.createGain();
        const depth = audioCtx.createGain();
        depth.gain.value = 0.5 //scale modulator output to [-0.5, 0.5]
        modulated.gain.value = 1.0 - depth.gain.value; //a fixed value of 0.5

        modulatorFreq.connect(depth).connect(modulated.gain); //.connect is additive, so with [-0.5,0.5] and 0.5, the modulated signal now has output gain at [0,1]
        carrier.connect(modulated)

        activeOscillators[key] = [modulatorFreq, gainNode];
        activeOscillators[key] = [carrier, gainNode];


        modulated.connect(audioCtx.destination);


        if (lfo_enabled) {
            lfo.connect(lfoGain).connect(modulatorFreq.frequency);
            lfo.start();
        }
    }
    else if (currentMethod == "FM") {
        const carrier = audioCtx.createOscillator();
        const modulatorFreq = audioCtx.createOscillator();

        carrier.start();
        modulatorFreq.start();

        const modulationIndex = audioCtx.createGain();
        modulationIndex.gain.setValueAtTime(keyboardFrequencyMap[key] * pitch, audioCtx.currentTime);
        modulatorFreq.frequency.setValueAtTime(keyboardFrequencyMap[key] * pitch, audioCtx.currentTime);

        carrier.type = currentWaveform;
        modulatorFreq.type = currentWaveform;

        modulatorFreq.connect(modulationIndex);
        modulationIndex.connect(carrier.frequency)

        carrier.connect(audioCtx.destination);

        activeOscillators[key] = [modulatorFreq, gainNode];
        activeOscillators[key] = [carrier, gainNode];

        if (lfo_enabled) {
            lfo.connect(lfoGain).connect(modulatorFreq.frequency);
            lfo.start();
        }

    }
    else {
        const osc = audioCtx.createOscillator();
        osc.frequency.setValueAtTime(keyboardFrequencyMap[key] * pitch, audioCtx.currentTime);
        osc.type = currentWaveform;

        //pass audio wave of osc into gain node
        osc.connect(gainNode);//.connect(globalGain);
        osc.start();

        //add both the osc and its respective gainNode to list
        activeOscillators[key] = [osc, gainNode];

        //connect globalGain to audioCtx.destination
        gainNode.connect(audioCtx.destination);

        //gain envelope
        //apply ASDR values to gain node
        //attack
        gainNode.gain.exponentialRampToValueAtTime(attackLevel, audioCtx.currentTime + attackTime);
        //decay
        gainNode.gain.exponentialRampToValueAtTime(sustainLevel, audioCtx.currentTime + attackTime + decayTime);
        //no ramping for sustain

        if (lfo_enabled) {
            lfo.connect(lfoGain).connect(osc.frequency);
            lfo.start();
        }
    }

    limitGain();
    activeNotesCount++;
    updateSphere();
}

function limitGain() {
    // add up the total gain from each individual gain node
    const totalGain = Object.values(activeOscillators)
        .reduce((acc, [osc, gainNode]) => acc + gainNode.gain.value, 0);

    // adjust each gain to ensure the total gain doesn't exceed 0.5
    if (totalGain > 0.5) {
        for (const activeKey in activeOscillators) {
            const [osc, gainNode] = activeOscillators[activeKey];
            // adjust each gain based on the total gain
            gainNode.gain.value *= 0.5 / totalGain;
        }
    }
}


// ref to dropdown for wave types
const waveformSelect = document.getElementById('waveform_select');

// adding listener to dropdown
waveformSelect.addEventListener('change', function () {
    // update  waveform variable when the selection changes
    currentWaveform = this.value;
    //log value
    console.log('Waveform value:', currentWaveform);
});

// ref to the form for synthesis method
const synthesisForm = document.querySelector('form');

// Adding event listener to the form
synthesisForm.addEventListener('change', function (event) {
    // Check if the changed element is a radio input
    if (event.target.type === 'radio') {
        // Update currentMethod when a different synthesis method is selected
        currentMethod = event.target.value;
        console.log('Synthesis method:', currentMethod);
    }
});

// ref to LFO checkbox
const lfoToggle = document.querySelector('input[type="checkbox"]');

// Adding event listener to the form
lfoToggle.addEventListener('change', function () {
    // update lfo_enabled variabe when the selection changes
    lfo_enabled = this.checked;
    console.log(lfo_enabled)
    //log value
    console.log('Waveform value:', lfo_enabled);
});

//update frequency value for slider
function updateFrequencyValue() {
    var slider = document.getElementById("LFOSlider1");
    lfo_frequency = parseFloat(slider.value);
    console.log("Frequency value updated: " + lfo_frequency);
}

function updateDepthValue() {
    var slider = document.getElementById("LFOSlider2");
    lfo_depth = parseFloat(slider.value);
    console.log("Depth value updated: " + lfo_depth);
}

function updatePitch() {
    var slider = document.getElementById("PitchSlider");
    pitch = parseFloat(slider.value);
    console.log("Pitch updated: " + pitch);
}

function updateRelease() {
    var slider = document.getElementById("ReleaseSlider");
    releaseTime = parseFloat(slider.value);
    console.log("Release updated: " + releaseTime);
}

function updatePartials() {
    var slider = document.getElementById("PartialsSlider");
    num_partials = parseInt(slider.value);
    console.log("Partials updated: " + num_partials);
}

function updateSphere() {
    const scaleFactor = 1 + (activeNotesCount * 0.1); //adjusting scaling of notes
    sphere.style.transform = `scale3d(${scaleFactor}, ${scaleFactor}, ${scaleFactor})`; //transforming based on scale factor
    sphere.style.backgroundColor = `rgba(0, 0, 0, ${0.2 + activeNotesCount * 0.15})`; // adjusting color 
}



// //setup demo

// const playButton = document.querySelector('button');

// playButton.addEventListener('click', function () {
//     if (!audioCtx) {
//         audioCtx = new (window.AudioContext || window.webkitAudioContext)
//         let osc = audioCtx.createOscillator();
//         osc.connect(audioCtx.destination);
//         osc.start();
//     }
// })