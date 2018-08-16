/* 
 * RIFFWAVE.js v0.03 - Audio encoder for HTML5 <audio> elements.
 * Copyleft 2011 by Pedro Ladaria <pedro.ladaria at Gmail dot com>
 *
 * Public Domain
 *
 * Changelog:
 *
 * 0.01 - First release
 * 0.02 - New faster base64 encoding
 * 0.03 - Support for 16bit samples
 *
 * Notes:
 *
 * 8 bit data is unsigned: 0..255
 * 16 bit data is signed: −32,768..32,767
 *
 */

var FastBase64 = {

    chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    encLookup: [],

    Init: function () {
        for (var i = 0; i < 4096; i++) {
            this.encLookup[i] = this.chars[i >> 6] + this.chars[i & 0x3F];
        }
    },

    Encode: function (src) {
        var len = src.length;
        var dst = '';
        var i = 0;
        while (len > 2) {
            n = (src[i] << 16) | (src[i + 1] << 8) | src[i + 2];
            dst += this.encLookup[n >> 12] + this.encLookup[n & 0xFFF];
            len -= 3;
            i += 3;
        }
        if (len > 0) {
            var n1 = (src[i] & 0xFC) >> 2;
            var n2 = (src[i] & 0x03) << 4;
            if (len > 1) n2 |= (src[++i] & 0xF0) >> 4;
            dst += this.chars[n1];
            dst += this.chars[n2];
            if (len == 2) {
                var n3 = (src[i++] & 0x0F) << 2;
                n3 |= (src[i] & 0xC0) >> 6;
                dst += this.chars[n3];
            }
            if (len == 1) dst += '=';
            dst += '=';
        }
        return dst;
    } // end Encode

}

FastBase64.Init();

var RIFFWAVE = function (data) {

    this.data = [];        // Array containing audio samples
    this.wav = [];         // Array containing the generated wave file
    this.dataURI = '';     // http://en.wikipedia.org/wiki/Data_URI_scheme

    this.header = {                         // OFFS SIZE NOTES
        chunkId: [0x52, 0x49, 0x46, 0x46], // 0    4    "RIFF" = 0x52494646
        chunkSize: 0,                     // 4    4    36+SubChunk2Size = 4+(8+SubChunk1Size)+(8+SubChunk2Size)
        format: [0x57, 0x41, 0x56, 0x45], // 8    4    "WAVE" = 0x57415645
        subChunk1Id: [0x66, 0x6d, 0x74, 0x20], // 12   4    "fmt " = 0x666d7420
        subChunk1Size: 16,                    // 16   4    16 for PCM
        audioFormat: 1,                     // 20   2    PCM = 1
        numChannels: 1,                     // 22   2    Mono = 1, Stereo = 2...
        sampleRate: 8000,                  // 24   4    8000, 44100...
        byteRate: 0,                     // 28   4    SampleRate*NumChannels*BitsPerSample/8
        blockAlign: 0,                     // 32   2    NumChannels*BitsPerSample/8
        bitsPerSample: 8,                     // 34   2    8 bits = 8, 16 bits = 16
        subChunk2Id: [0x64, 0x61, 0x74, 0x61], // 36   4    "data" = 0x64617461
        subChunk2Size: 0                      // 40   4    data size = NumSamples*NumChannels*BitsPerSample/8
    };

    function u32ToArray(i) {
        return [i & 0xFF, (i >> 8) & 0xFF, (i >> 16) & 0xFF, (i >> 24) & 0xFF];
    }

    function u16ToArray(i) {
        return [i & 0xFF, (i >> 8) & 0xFF];
    }

    function split16bitArray(data) {
        var r = [];
        var j = 0;
        var len = data.length;
        for (var i = 0; i < len; i++) {
            r[j++] = data[i] & 0xFF;
            r[j++] = (data[i] >> 8) & 0xFF;
        }
        return r;
    }

    this.Make = function (data) {
        if (data instanceof Array) this.data = data;
        this.header.blockAlign = (this.header.numChannels * this.header.bitsPerSample) >> 3;
        this.header.byteRate = this.header.blockAlign * this.sampleRate;
        this.header.subChunk2Size = this.data.length * (this.header.bitsPerSample >> 3);
        this.header.chunkSize = 36 + this.header.subChunk2Size;

        this.wav = this.header.chunkId.concat(
            u32ToArray(this.header.chunkSize),
            this.header.format,
            this.header.subChunk1Id,
            u32ToArray(this.header.subChunk1Size),
            u16ToArray(this.header.audioFormat),
            u16ToArray(this.header.numChannels),
            u32ToArray(this.header.sampleRate),
            u32ToArray(this.header.byteRate),
            u16ToArray(this.header.blockAlign),
            u16ToArray(this.header.bitsPerSample),
            this.header.subChunk2Id,
            u32ToArray(this.header.subChunk2Size),
            (this.header.bitsPerSample == 16) ? split16bitArray(this.data) : this.data
        );
        this.dataURI = 'data:audio/wav;base64,' + FastBase64.Encode(this.wav);
    };

    if (data instanceof Array) this.Make(data);

}; // end RIFFWAVE

var notes = [
    { "f": 261.63, "name": "C" },
    { "f": 277.18, "name": "C#" },
    { "f": 293.66, "name": "D" },
    { "f": 311.13, "name": "D#" },
    { "f": 329.63, "name": "E" },
    { "f": 349.23, "name": "F" },
    { "f": 369.99, "name": "F#" },
    { "f": 392, "name": "G" },
    { "f": 415.3, "name": "G#" },
    { "f": 440, "name": "A" },
    { "f": 466.16, "name": "A#" },
    { "f": 493.88, "name": "B" }
];
var sounds = {};
var composition = null;
var frequencies = [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392, 415.3, 440, 466.16, 493.88, 523.26, 554.37, 587.33, 622.25, 659.26, 698.46, 739.99, 783.99, 830.61, 880, 932.33, 987.77, 1046.52]
var sampleRate = 44100;
var FTimeAray = [
    { time: 1 / 4, frequency: [261.63] },
    { time: 1 / 4, frequency: [277.18] },
    { time: 1 / 4, frequency: [293.66] },
    { time: 1 / 4, frequency: [311.13] },
    { time: 1 / 4, frequency: [329.63] },
    { time: 1 / 4, frequency: [349.23] },
    { time: 1 / 4, frequency: [369.99] },
    { time: 1 / 4, frequency: [392] },
    { time: 1 / 4, frequency: [415.3] },
    { time: 1 / 4, frequency: [440] },
    { time: 1 / 4, frequency: [466.16] },
    { time: 1 / 4, frequency: [493.88] },
    { time: 1 / 4, frequency: [523.26] },
    { time: 1 / 4, frequency: [554.37] },
    { time: 1 / 4, frequency: [587.33] },
    { time: 1 / 4, frequency: [622.25] },
    { time: 1 / 4, frequency: [659.26] },
    { time: 1 / 4, frequency: [698.46] },
    { time: 1 / 4, frequency: [739.99] },
    { time: 1 / 4, frequency: [783.99] },
    { time: 1 / 4, frequency: [830.61] },
    { time: 1 / 4, frequency: [880] },
    { time: 1 / 4, frequency: [932.33] },
    { time: 1 / 4, frequency: [987.77] }
];

FTimeAray = FTimeAray.concat(FTimeAray.map(function (item) {
    return {
        time: item.time,
        frequency: [item.frequency[0] * 2]
    };
}));

var compositions = JSON.parse(localStorage.getItem('compositions')) || [];

function makeComposition() {
    var notes = document.querySelectorAll(".times");
    var velocity = document.querySelector('.velocity').valueAsNumber;
    var ftarray = [];
    for (var i = 0; i < notes.length; i++) {
        var note = notes[i];
        var ft = { time: 1 / velocity, frequency: [0] };
        var inputs = note.querySelectorAll('input');
        for (var j = 0; j < inputs.length; j++) {
            var input = inputs[j];
            if (input.checked) {
                ft.frequency.push(Number(input.getAttribute('data-freq')));
            }
        }
        ftarray.push(ft);
    }

    var index = document.querySelector('#index').valueAsNumber;
    compositions[index] = ftarray;
    localStorage.setItem('compositions', JSON.stringify(compositions));
    composition = makeNotesTimes(ftarray);
}

function playStoredComposition() {
    var index = document.querySelector('#index');
    var comp = compositions[index.valueAsNumber];
    var song = makeNotesTimes(comp);
    song.play();
}

function playComposition() {
    composition.load();
    composition.play();
}

function stopComposition() {
    composition.pause();
    composition.load();
}

function makeNotesTimes(ntarray) {
    return makeSound(makeSamples(ntarray));
}

var allSounds = makeSound(makeSamples(FTimeAray).concat(makeSamples(FTimeAray.reverse())));

for (var i in FTimeAray) {
    var note = FTimeAray[i];
    sounds[note.frequency] = makeSound(makeSample(note.frequency, note.time));
}

function play(f) {
    sounds[f].play();
}

function playAll() {
    allSounds.play();
}

function makeSamples(FTimeAray) {
    var samples = [];
    for (var i in FTimeAray) {
        var note = FTimeAray[i];
        samples = samples.concat(makeSample(note.frequency, note.time));
    }

    return samples;
}

function makeSample(frequency, time) {
    //  var samples_length = sampleRate; // divide by 2 ???
    var samples = []; //new Float32Array(samples_length);
    var samples_length = sampleRate * time;               // Plays for 1 second (44.1 KHz)
    for (var i = 0; i < samples_length; i++) { // fills array with samples
        var t = i / sampleRate;               // time from 0 to 1
        samples[i] = 0;

        for (var j in frequency) {
            samples[i] += Math.sin(frequency[j] * 2 * Math.PI * t) / frequency.length;
        }
    }

    return samples;
}

function makeSound(samples) {

    normalize_invalid_values(samples); // keep samples between [-1, +1]

    var wave = new RIFFWAVE();
    wave.header.sampleRate = sampleRate;
    wave.header.numChannels = 1;
    var audio = new Audio();
    var samples2 = convert255(samples);
    wave.Make(samples2);
    audio.src = wave.dataURI;
    return audio;
    //setTimeout(function () { audio.play(); }, 10); // page needs time to load?
    //audio.play();
}

function normalize_invalid_values(samples) {
    for (var i = 0, len = samples.length; i < len; i++) {
        if (samples[i] > 1) {
            samples[i] = 1;
        } else if (samples[i] < -1) {
            samples[i] = -1;
        }
    }
}

function convert255(data) {
    var data_0_255 = [];
    for (var i = 0; i < data.length; i++) {
        data_0_255[i] = 128 + Math.round(127 * data[i]);
    }
    return data_0_255;
}

function createScreen() {
    notes = notes.concat(notes.map(function (item) {
        return {
            "f": item.f * 2,
            "name": item.name
        };
    }));
    var container = document.querySelector('.notes');
    var labels = document.createElement('div');
    var note = null;
    container.appendChild(labels);
    for (var i = 0; i < notes.length; i++) {
        note = notes[i];
        var p = document.createElement('p');
        p.innerHTML = note.name;
        labels.appendChild(p);
    }

    for (var j = 0; j < 100; j++) {
        var times = document.createElement('div');
        times.classList.add('times');
        for (var k = 0; k < notes.length; k++) {
            let innerNote = notes[k];
            var noteInput = document.createElement('input');
            noteInput.setAttribute('data-freq', innerNote.f);
            noteInput.type = 'checkbox';
            times.appendChild(noteInput);
            noteInput.addEventListener('click', function () {
                sounds[innerNote.f].play();
            });
        }
        container.appendChild(times);
    }
}

function loadStoredComposition() {
    limpar();
    var index = document.querySelector('#index').valueAsNumber;
    var comp = compositions[index];
    var times = document.querySelectorAll(".times");

    for (var i in comp) {
        for (var j in comp[i].frequency) {
            var f = comp[i].frequency[j];
            (times[i].querySelector('[data-freq="' + f + '"]') || {}).checked = true;
        }
    }
}

function limpar() {
    var inputs = document.querySelectorAll('input');
    for (var i in inputs) {
        inputs[i].checked = false;
    }
}

createScreen();