const playPanel = document.getElementById("playPanel");
const infoPanel = document.getElementById("infoPanel");
const countPanel = document.getElementById("countPanel");
const scorePanel = document.getElementById("scorePanel");
const japanese = document.getElementById("japanese");
const gameTime = 180;
let gameTimer;
// https://dova-s.jp/bgm/play17691.html
const bgm = new Audio("mp3/bgm.mp3");
bgm.volume = 0.1;
bgm.loop = true;
let solvedCount = 0;
let problemCount = 5;
let correctCount = 0;
let incorrectCount = 0;
let mistaken = false;
let problems = [];
const audioContext = new AudioContext();
const audioBufferCache = {};
loadAudio("end", "mp3/end.mp3");
loadAudio("correct", "mp3/correct3.mp3");
loadAudio("incorrect", "mp3/cat.mp3");
loadConfig();

function loadConfig() {
  if (localStorage.getItem("darkMode") == 1) {
    document.documentElement.setAttribute("data-bs-theme", "dark");
  }
  if (localStorage.getItem("bgm") != 1) {
    document.getElementById("bgmOn").classList.add("d-none");
    document.getElementById("bgmOff").classList.remove("d-none");
  }
}

function toggleDarkMode() {
  if (localStorage.getItem("darkMode") == 1) {
    localStorage.setItem("darkMode", 0);
    document.documentElement.setAttribute("data-bs-theme", "light");
  } else {
    localStorage.setItem("darkMode", 1);
    document.documentElement.setAttribute("data-bs-theme", "dark");
  }
}

function toggleBGM() {
  if (localStorage.getItem("bgm") == 1) {
    document.getElementById("bgmOn").classList.add("d-none");
    document.getElementById("bgmOff").classList.remove("d-none");
    localStorage.setItem("bgm", 0);
    bgm.pause();
  } else {
    document.getElementById("bgmOn").classList.remove("d-none");
    document.getElementById("bgmOff").classList.add("d-none");
    localStorage.setItem("bgm", 1);
    bgm.play();
  }
}

async function playAudio(name, volume) {
  const audioBuffer = await loadAudio(name, audioBufferCache[name]);
  const sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;
  if (volume) {
    const gainNode = audioContext.createGain();
    gainNode.gain.value = volume;
    gainNode.connect(audioContext.destination);
    sourceNode.connect(gainNode);
    sourceNode.start();
  } else {
    sourceNode.connect(audioContext.destination);
    sourceNode.start();
  }
}

async function loadAudio(name, url) {
  if (audioBufferCache[name]) return audioBufferCache[name];
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  audioBufferCache[name] = audioBuffer;
  return audioBuffer;
}

function unlockAudio() {
  audioContext.resume();
}

async function loadProblems() {
  const response = await fetch(`problems.json`);
  const json = await response.json();
  problems = json;
}

function nextProblem() {
  solvedCount = 0;
  mistaken = false;
  setProblem();
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

function kanaToHira(str) {
  return str.replace(/[\u30a1-\u30f6]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

function getFuriganaHTML(morpheme) {
  let html = "";
  const furiganas = getFuriganas(morpheme);
  if (furiganas) {
    furiganas.forEach((furigana) => {
      if (furigana[1]) {
        html += `<ruby>${furigana[0]}<rt>${furigana[1]}</rt></ruby>`;
      } else {
        html += `<span>${furigana[0]}</span>`;
      }
    });
  } else {
    html += `<span>${morpheme.surface}</span>`;
  }
  return html;
}

function getFuriganas(morpheme) {
  const reading = morpheme.reading;
  if (!reading) return undefined;
  const surface = morpheme.surface;
  if (surface == reading) return undefined;
  const hiraSurface = kanaToHira(surface);
  const hiraReading = kanaToHira(reading);
  if (hiraSurface == hiraReading) return undefined;
  // 楽しい --> ([ぁ-ん+])しい --> (たの)しい --> ["たの"]
  // 行き来 --> ([ぁ-ん+])き([ぁ-ん]+) --> (い)き(き), --> ["い", "き"]
  const searchString = hiraSurface.replaceAll(/[一-龠々ヵヶ]+/g, "([ぁ-ん]+)");
  const furiganaRegexp = new RegExp(searchString);
  const furiganas = hiraReading.match(furiganaRegexp).slice(1);
  const map = new Map();
  const kanjis = surface.match(/([一-龠々ヵヶ]+)/g);
  kanjis.forEach((kanji, i) => {
    map.set(kanji, furiganas[i]);
  });
  const words = surface.split(/([一-龠々ヵヶ]+)/g).filter((s) => s != "");
  const result = words.map((word) => {
    const furigana = map.get(word);
    if (furigana) {
      return [word, furigana];
    } else {
      return [word, undefined];
    }
  });
  return result;
}

function mergePOS(course, problem) {
  if (course != "大人") {
    problem = mergeAdjectiveVerbs(problem);
  }
  if (course == "小学生") {
    problem = mergeAuxiliaryVerbs(problem);
  }
  return problem;
}

function mergeAuxiliaryVerbs(problem) {
  const newProblem = [];
  let merged = false;
  problem.forEach((morpheme, i) => {
    const nextMorpheme = problem[i + 1];
    if (
      morpheme.feature == "動詞" &&
      nextMorpheme &&
      nextMorpheme.feature == "助動詞"
    ) {
      merged = true;
      const m = {
        feature: "動詞",
        surface: morpheme.surface + nextMorpheme.surface,
        reading: morpheme.reading + nextMorpheme.reading,
        featureDetails: morpheme.featureDetails,
        conjugationForms: morpheme.conjugationForms,
      };
      newProblem.push(m);
    } else if (merged) {
      merged = false;
    } else {
      newProblem.push(morpheme);
    }
  });
  return newProblem;
}

function mergeAdjectiveVerbs(problem) {
  const newProblem = [];
  let merged = false;
  problem.forEach((morpheme, i) => {
    const nextMorpheme = problem[i + 1];
    if (
      morpheme.featureDetails[0] == "形容動詞語幹" &&
      nextMorpheme &&
      nextMorpheme.feature == "助動詞"
    ) {
      merged = true;
      const m = {
        feature: "形容動詞",
        surface: morpheme.surface + nextMorpheme.surface,
        reading: morpheme.surface + nextMorpheme.reading,
        featureDetails: ["*", "*", "*"],
        conjugationForms: nextMorpheme.conjugationForms,
      };
      newProblem.push(m);
    } else if (merged) {
      merged = false;
    } else {
      newProblem.push(morpheme);
    }
  });
  return newProblem;
}

function setChoice(morpheme, wrapperNode) {
  wrapperNode.className = "btn btn-light btn-lg m-1 px-2 choice";
  const surfaceNode = document.createElement("div");
  const html = getFuriganaHTML(morpheme);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const spans = [...doc.body.childNodes];
  surfaceNode.replaceChildren(...spans);
  const posBox = new POSBox(morpheme.feature, wrapperNode);
  wrapperNode.appendChild(surfaceNode);
  wrapperNode.appendChild(posBox);
}

function setProblem() {
  firstRun = false;
  const selectNode = document.getElementById("courseOption");
  const courseNode = selectNode.options[selectNode.selectedIndex];
  const course = courseNode.value;
  document.getElementById("explanation").textContent = `品詞を選んでください`;
  let problem = problems[getRandomInt(0, problems.length)];
  problem = mergePOS(course, problem);
  const nextProblems = [];
  let choiceCount = 0;
  problem.forEach((morpheme) => {
    const wrapperNode = document.createElement("div");
    switch (morpheme.feature) {
      case "フィラー":
      case "間投詞":
      case "記号":
        wrapperNode.className = "btn btn-light btn-lg m-1 px-2";
        wrapperNode.textContent = morpheme.surface;
        break;
      case "感動詞":
      case "接頭詞":
      case "連体詞":
      case "助動詞":
      case "形容動詞":
        if (course == "小学生") {
          wrapperNode.className = "btn btn-light btn-lg m-1 px-2";
          wrapperNode.textContent = morpheme.surface;
        } else {
          setChoice(morpheme, wrapperNode);
          choiceCount += 1;
        }
        break;
      default:
        setChoice(morpheme, wrapperNode);
        choiceCount += 1;
    }
    nextProblems.push(wrapperNode);
  });
  problemCount = choiceCount;
  japanese.replaceChildren(...nextProblems);
}

function countdown() {
  mistaken = false;
  correctCount = incorrectCount = 0;
  countPanel.classList.remove("d-none");
  infoPanel.classList.add("d-none");
  playPanel.classList.add("d-none");
  scorePanel.classList.add("d-none");
  counter.textContent = 3;
  const timer = setInterval(() => {
    const counter = document.getElementById("counter");
    const colors = ["skyblue", "greenyellow", "violet", "tomato"];
    if (parseInt(counter.textContent) > 1) {
      const t = parseInt(counter.textContent) - 1;
      counter.style.backgroundColor = colors[t];
      counter.textContent = t;
    } else {
      clearInterval(timer);
      countPanel.classList.add("d-none");
      infoPanel.classList.remove("d-none");
      playPanel.classList.remove("d-none");
      setProblem();
      startGameTimer();
      if (localStorage.getItem("bgm") == 1) {
        bgm.play();
      }
    }
  }, 1000);
}

function startGame() {
  initTime();
  countdown();
}

function startGameTimer() {
  const timeNode = document.getElementById("time");
  gameTimer = setInterval(() => {
    const t = parseInt(timeNode.textContent);
    if (t > 0) {
      timeNode.textContent = t - 1;
    } else {
      clearInterval(gameTimer);
      bgm.pause();
      playAudio("end");
      playPanel.classList.add("d-none");
      scorePanel.classList.remove("d-none");
      scoring();
    }
  }, 1000);
}

function initTime() {
  document.getElementById("time").textContent = gameTime;
}

function scoring() {
  const totalCount = correctCount + incorrectCount + mistaken;
  document.getElementById("score").textContent = correctCount;
  document.getElementById("count").textContent = totalCount;
}

function showAnswer() {
  mistaken = true;
  incorrectCount += 1;
  solvedCount += 1;
  const morphemes = [...japanese.children];
  const index = morphemes.findIndex((wrapperNode) => {
    if (!wrapperNode.classList.contains("choice")) return false;
    if (!wrapperNode.classList.contains("border-primary")) return true;
  });
  if (index >= 0) {
    const wrapperNode = morphemes[index];
    wrapperNode.classList.remove("border-danger");
    wrapperNode.classList.add("bg-danger", "border", "border-primary");
    const posBox = wrapperNode.querySelector("pos-box");
    const select = posBox
      ? posBox.shadowRoot.querySelector("select")
      : wrapperNode.querySelector("select");
    select.disabled = true;
    const answer = select.dataset.answer;
    const option = [...select.options].find((option) => {
      if (option.value == answer) return true;
    });
    option.selected = true;
    wrapperNode.classList.add("bd-danger");
    if (problemCount <= solvedCount) {
      answerButton.disabled = true;
      setTimeout(() => {
        answerButton.disabled = false;
        nextProblem();
      }, 5000);
    }
  }
}

class POSBox extends HTMLElement {
  constructor(answer, wrapperNode) {
    super();
    const template = document.getElementById("pos-box")
      .content.cloneNode(true);
    const select = template.querySelector("select");
    select.dataset.answer = answer;
    select.onchange = () => {
      if (select.value == answer) {
        wrapperNode.classList.remove("border-danger");
        wrapperNode.classList.add("border", "border-primary");
        select.disabled = true;
        playAudio("correct");
        if (mistaken) {
          incorrectCount += 1;
        } else {
          correctCount += 1;
        }
        solvedCount += 1;
        if (problemCount <= solvedCount) nextProblem();
      } else {
        mistaken = true;
        wrapperNode.classList.add("border", "border-danger");
        playAudio("incorrect");
      }
    };
    this.attachShadow({ mode: "open" }).appendChild(template);
  }
}
customElements.define("pos-box", POSBox);

loadProblems();

document.getElementById("toggleDarkMode").onclick = toggleDarkMode;
document.getElementById("toggleBGM").onclick = toggleBGM;
document.getElementById("startButton").onclick = startGame;
document.getElementById("answerButton").onclick = showAnswer;
document.addEventListener("click", unlockAudio, {
  once: true,
  useCapture: true,
});
