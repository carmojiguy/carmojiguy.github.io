/**
 * Website photos studio — catalog, local enhance, History, samples.
 * No API keys live here. Remote enhance is optional via /api/photo-enhance.
 */
(function (root) {
  "use strict";

  var WS = {};
  WS.DAMAGE_COPY = "Damage stays. Dirt goes.";
  WS.DAMAGE_STAYS_PROMPT =
    "Damage stays. Dirt goes. Remove dirt, dust, and grime only. " +
    "Make the vehicle look freshly detailed, including a dirty interior. " +
    "Do not inpaint, heal, blur, or reconstruct scratches, dents, chips, " +
    "cracks, rust, or broken glass. Lighting and exposure polish is allowed.";
  WS.HISTORY_KEY = "inspect.webStudio.history";
  WS.SAMPLE_VER = "webstudio5";
  WS.INTERIOR = { dash: 1, console: 1, interior: 1 };
  WS.VIEW_ORDER = [
    "qfront", "front", "driver", "qrear_drv", "rear", "qrear_pass",
    "pass", "qfront_pass", "dash", "console", "tire", "interior"
  ];
  WS.VIEW_LABELS = {
    qfront: "3/4 Front",
    front: "Front",
    driver: "Driver side",
    qrear_drv: "3/4 Rear driver",
    rear: "Rear",
    qrear_pass: "3/4 Rear passenger",
    pass: "Passenger side",
    qfront_pass: "3/4 Front passenger",
    dash: "Dashboard",
    console: "Console",
    tire: "Tire",
    interior: "Driver interior"
  };

  function wiki(name) {
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" +
      encodeURIComponent(name) + "?width=1400";
  }

  function plate(id, name, sky, ground, accent, motif) {
    return { id: id, name: name, sky: sky, ground: ground, accent: accent, motif: motif };
  }

  WS.CATALOG = {
    dealership: [
      plate("dlr-01", "Bright retail lot", ["#9AD8FF", "#E8F6FF"], ["#C5CCD3", "#8E959C"], "#FFE14A", "lot"),
      plate("dlr-02", "Glass showroom day", ["#D7F1FF", "#FFFFFF"], ["#E8EEF3", "#B7C3CF"], "#7C5CFF", "glass"),
      plate("dlr-03", "Night LED showroom", ["#0B1430", "#1B2A6B"], ["#111827", "#0B1220"], "#19C6FF", "night"),
      plate("dlr-04", "White cyclorama", ["#F7FBFF", "#FFFFFF"], ["#EEF2F6", "#D9E1E8"], "#B8C4CE", "cove"),
      plate("dlr-05", "Black gloss floor", ["#1A1C22", "#2C3140"], ["#0A0B0E", "#1A1C22"], "#E8C36A", "gloss"),
      plate("dlr-06", "Concrete studio", ["#D5D8DD", "#F2F3F5"], ["#A8ADB5", "#7E848C"], "#C4A35A", "concrete"),
      plate("dlr-07", "Sunset lot", ["#FFB070", "#FFE2B8"], ["#6B5344", "#3E322C"], "#FF7A3D", "lot"),
      plate("dlr-08", "Covered atrium", ["#C8E8D8", "#F3FFF8"], ["#D7E4DC", "#9BB0A6"], "#3EE0B8", "glass"),
      plate("dlr-09", "Rooftop terrace", ["#87C6F5", "#EAF6FF"], ["#B7C0C8", "#8A929A"], "#FFE14A", "lot"),
      plate("dlr-10", "Indoor LED wall", ["#121826", "#243056"], ["#0E1320", "#1A2236"], "#7C5CFF", "night"),
      plate("dlr-11", "Mirror-floor studio", ["#E8F0FF", "#FFFFFF"], ["#CBD6E4", "#9AABC0"], "#19C6FF", "gloss"),
      plate("dlr-12", "Champagne lounge", ["#F6E7C8", "#FFF8EC"], ["#D9C4A0", "#B79A70"], "#C4A35A", "lounge"),
      plate("dlr-13", "Rain-wet asphalt", ["#6B7C8C", "#A9B8C6"], ["#2A3138", "#12161A"], "#19C6FF", "wet"),
      plate("dlr-14", "Morning lot haze", ["#CDE8FF", "#FFF7E8"], ["#D5D9DE", "#AAB1B8"], "#FFE14A", "lot"),
      plate("dlr-15", "Penthouse garage", ["#1C2230", "#3A4458"], ["#11151C", "#222833"], "#E8C36A", "garage"),
      plate("dlr-16", "Dealership canopy", ["#B9D8F2", "#F2F9FF"], ["#C8CED4", "#8E959C"], "#00A4E2", "canopy"),
      plate("dlr-17", "White marble hall", ["#F4F1EC", "#FFFFFF"], ["#E4DDD2", "#C8BBA8"], "#C4A35A", "marble"),
      plate("dlr-18", "Graphite tunnel", ["#2A2E36", "#4A5160"], ["#14171C", "#262A32"], "#19C6FF", "tunnel"),
      plate("dlr-19", "Daylight box", ["#EAF4FF", "#FFFFFF"], ["#DCE6F0", "#B7C4D2"], "#7C5CFF", "cove"),
      plate("dlr-20", "Soft gray cove", ["#E6E9EE", "#F7F8FA"], ["#C9CED6", "#9AA3AE"], "#8B93A0", "cove"),
      plate("dlr-21", "Neon mezzanine", ["#1A1030", "#3A1A58"], ["#120C20", "#241830"], "#FF4D9A", "night"),
      plate("dlr-22", "Service drive clean", ["#D8E8F4", "#F6FBFF"], ["#C5CCD3", "#8E959C"], "#00A4E2", "lot"),
      plate("dlr-23", "Flagship glass cube", ["#BFE4FF", "#FFFFFF"], ["#D5DEE6", "#A7B4C0"], "#19C6FF", "glass"),
      plate("dlr-24", "Twilight lot", ["#3A4A78", "#F0B48A"], ["#2A3038", "#12161A"], "#FF8A4A", "lot"),
      plate("dlr-25", "Polar white sweep", ["#F8FCFF", "#FFFFFF"], ["#E8EEF4", "#C9D3DE"], "#B8C4CE", "cove"),
      plate("dlr-26", "Carbon showroom", ["#1C1E22", "#32363E"], ["#0E1014", "#1C1E22"], "#E8C36A", "gloss"),
      plate("dlr-27", "Gold hour lot", ["#FFC878", "#FFEFD2"], ["#8A6A40", "#4A3A24"], "#FFB020", "lot"),
      plate("dlr-28", "Sky-bridge garage", ["#8EC8F0", "#EAF6FF"], ["#C5CCD3", "#8E959C"], "#19C6FF", "garage"),
      plate("dlr-29", "Boutique salon", ["#F3E8FF", "#FFF9FF"], ["#E4D6F2", "#C2B0D8"], "#7C5CFF", "lounge"),
      plate("dlr-30", "Infinity white", ["#FFFFFF", "#F2F7FB"], ["#E6EEF4", "#C9D5E0"], "#19C6FF", "cove")
    ],
    landscape: [
      plate("lnd-01", "Mountain road", ["#7EB6E8", "#E8F4FF"], ["#6B7A6A", "#3E4A3C"], "#C4D4B0", "mountain"),
      plate("lnd-02", "Lakeside dawn", ["#FFB8A0", "#87C8E8"], ["#2A6A88", "#134058"], "#FFE14A", "lake"),
      plate("lnd-03", "Autumn forest", ["#F0C070", "#F8E8C8"], ["#8A4020", "#4A2410"], "#E07030", "forest"),
      plate("lnd-04", "Desert mesa", ["#F0C878", "#FFE8B8"], ["#C48A48", "#8A5A28"], "#E8A040", "desert"),
      plate("lnd-05", "Coastal highway", ["#6EC8F0", "#E0F4FF"], ["#2A7A9A", "#124858"], "#FFE14A", "coast"),
      plate("lnd-06", "Snow peaks", ["#C8DCEC", "#FFFFFF"], ["#E8F0F6", "#B8C8D4"], "#B8D4E8", "snow"),
      plate("lnd-07", "Vineyard rows", ["#B8D878", "#F4F8E0"], ["#6A8A38", "#3A5018"], "#C4A35A", "vineyard"),
      plate("lnd-08", "Prairie gold", ["#F0D878", "#FFF4C8"], ["#C8A048", "#8A7028"], "#E8C36A", "prairie"),
      plate("lnd-09", "Alpine pass", ["#8AB8E0", "#E8F4FF"], ["#6A7A70", "#3A4440"], "#C8D8E8", "mountain"),
      plate("lnd-10", "Pacific overlook", ["#4AA0D0", "#C8E8F8"], ["#1A4A68", "#0A2838"], "#19C6FF", "coast"),
      plate("lnd-11", "Canyon rim", ["#E8A060", "#F8D8A8"], ["#8A4030", "#4A2018"], "#D07040", "canyon"),
      plate("lnd-12", "Foggy pines", ["#A8B8B0", "#D8E4DC"], ["#3A4A40", "#1A2420"], "#8AA898", "forest"),
      plate("lnd-13", "Cherry blossom park", ["#F8C8D8", "#FFF0F4"], ["#88B070", "#4A6840"], "#F090B0", "park"),
      plate("lnd-14", "Scottish glen", ["#88B8A0", "#D8F0E0"], ["#4A6848", "#243828"], "#C4A35A", "glen"),
      plate("lnd-15", "Icelandic moss", ["#88C8B0", "#D0F0E8"], ["#3A5A48", "#1C3028"], "#6EC8A8", "moss"),
      plate("lnd-16", "Tropical palm drive", ["#40C8E0", "#E8FFF4"], ["#2A8A60", "#145038"], "#FFE14A", "palm"),
      plate("lnd-17", "Wheat field", ["#F0D060", "#FFF4C0"], ["#C8A030", "#8A7018"], "#E8C040", "prairie"),
      plate("lnd-18", "Red rock valley", ["#E87848", "#F8C8A0"], ["#8A3020", "#4A1810"], "#E06030", "canyon"),
      plate("lnd-19", "Nordic fjord", ["#6AA0C8", "#D0E8F4"], ["#2A4A58", "#142830"], "#B8D4E8", "fjord"),
      plate("lnd-20", "Olive grove", ["#C8D070", "#F4F0D0"], ["#6A6830", "#3A3818"], "#C4A35A", "grove"),
      plate("lnd-21", "Lavender field", ["#C8B0E8", "#F4ECFF"], ["#6A58A0", "#3A3060"], "#A080D8", "field"),
      plate("lnd-22", "Great Lakes shore", ["#70B8E0", "#E0F4FF"], ["#2A6080", "#143848"], "#19C6FF", "coast"),
      plate("lnd-23", "Rocky ridge", ["#A0B0C0", "#E0E8F0"], ["#5A6068", "#2A3038"], "#8A929A", "mountain"),
      plate("lnd-24", "Maple ridge", ["#E07038", "#F8D0A0"], ["#6A3820", "#3A1C10"], "#E07030", "forest"),
      plate("lnd-25", "Dune road", ["#F0D090", "#FFF4D8"], ["#D0B068", "#8A7040"], "#E8C36A", "desert"),
      plate("lnd-26", "Glacier lake", ["#70C8E0", "#E8F8FF"], ["#2A6880", "#143848"], "#B8E8F4", "lake"),
      plate("lnd-27", "Hill country", ["#A8D080", "#F0F8D8"], ["#688048", "#384828"], "#C4D4A0", "glen"),
      plate("lnd-28", "Rainforest edge", ["#40A070", "#C8E8C0"], ["#1A4830", "#0C2418"], "#3EE0B8", "forest"),
      plate("lnd-29", "High desert", ["#E8C878", "#FFF0C8"], ["#A07840", "#604828"], "#E8A040", "desert"),
      plate("lnd-30", "River valley", ["#88C8A8", "#E0F4EC"], ["#3A6858", "#1C3830"], "#6EC8A8", "lake")
    ],
    landmark: [
      plate("lmk-01", "Eiffel Tower", ["#7EB4E0", "#F0E8D8"], ["#8A8A90", "#4A4A50"], "#C4A35A", "tower"),
      plate("lmk-02", "Colosseum", ["#F0C890", "#FFF0D8"], ["#A08060", "#604830"], "#C4A35A", "colosseum"),
      plate("lmk-03", "Times Square", ["#1A1430", "#3A2060"], ["#121018", "#241830"], "#FF4D6A", "square"),
      plate("lmk-04", "Golden Gate", ["#70B8E0", "#E0F0FF"], ["#2A6A88", "#143848"], "#E07030", "bridge"),
      plate("lmk-05", "CN Tower", ["#6AA8D8", "#E8F4FF"], ["#4A5560", "#2A3038"], "#E23B3B", "cntower"),
      plate("lmk-06", "Big Ben", ["#88B0D0", "#E8F0F8"], ["#6A7068", "#3A4038"], "#C4A35A", "clock"),
      plate("lmk-07", "Santorini", ["#6EC8F0", "#E8F8FF"], ["#F0F4F8", "#D0D8E0"], "#19C6FF", "island"),
      plate("lmk-08", "Dubai skyline", ["#1A2848", "#E8A060"], ["#141820", "#2A3038"], "#E8C36A", "skyline"),
      plate("lmk-09", "Sydney Opera", ["#70C0E8", "#E8F8FF"], ["#2A7A98", "#145068"], "#F4F0E8", "opera"),
      plate("lmk-10", "Statue of Liberty", ["#6AB0D8", "#E0F0FF"], ["#2A5A78", "#143848"], "#3EE0B8", "statue"),
      plate("lmk-11", "Tokyo Tower", ["#4A60A0", "#F0B080"], ["#2A3038", "#141820"], "#E23B3B", "tower"),
      plate("lmk-12", "Space Needle", ["#78B8E0", "#E8F4FF"], ["#4A5560", "#2A3038"], "#19C6FF", "needle"),
      plate("lmk-13", "Sagrada Família", ["#E8C8A0", "#FFF4E8"], ["#A08060", "#604830"], "#C4A35A", "sagrada"),
      plate("lmk-14", "Christ the Redeemer", ["#70C0E0", "#E8F8FF"], ["#3A8A58", "#1C5030"], "#FFFFFF", "redeemer"),
      plate("lmk-15", "Burj Khalifa", ["#1A2840", "#C89050"], ["#121820", "#2A3038"], "#E8C36A", "skyline"),
      plate("lmk-16", "London Eye", ["#88B8D8", "#E8F4FF"], ["#4A6070", "#283038"], "#E23B3B", "wheel"),
      plate("lmk-17", "Château Frontenac", ["#88B0C8", "#F0E8D8"], ["#6A7068", "#3A4038"], "#C4A35A", "castle"),
      plate("lmk-18", "Parliament Hill", ["#70A8D0", "#E8F4FF"], ["#4A6848", "#283828"], "#E23B3B", "parliament"),
      plate("lmk-19", "Marina Bay", ["#1A3060", "#F0A050"], ["#121820", "#2A3038"], "#19C6FF", "skyline"),
      plate("lmk-20", "Brooklyn Bridge", ["#78B0D8", "#E8F0F8"], ["#3A4A58", "#1C2830"], "#C4A35A", "bridge"),
      plate("lmk-21", "Hollywood Hills", ["#F0B070", "#FFE8C0"], ["#6A5840", "#3A3020"], "#FFE14A", "hills"),
      plate("lmk-22", "Table Mountain", ["#70B8E0", "#E8F4FF"], ["#8A7A60", "#4A4030"], "#C4D4B0", "table"),
      plate("lmk-23", "Matterhorn", ["#88C0E0", "#F0F8FF"], ["#C8D4DC", "#8A9AA8"], "#FFFFFF", "mountain"),
      plate("lmk-24", "Acropolis", ["#E8C890", "#FFF4DC"], ["#B09060", "#6A5030"], "#C4A35A", "temple"),
      plate("lmk-25", "Trevi Fountain", ["#A0C8E0", "#F0F6FA"], ["#8A9098", "#4A5058"], "#C4D4E0", "fountain"),
      plate("lmk-26", "Tower Bridge", ["#78B0D0", "#E8F4FF"], ["#3A4A58", "#1C2830"], "#E23B3B", "bridge"),
      plate("lmk-27", "Empire State", ["#6A88B8", "#D8E8F8"], ["#2A3038", "#141820"], "#E8C36A", "skyline"),
      plate("lmk-28", "Notre-Dame", ["#88B0C8", "#E8F0F4"], ["#6A7068", "#3A4038"], "#C4A35A", "cathedral"),
      plate("lmk-29", "Alhambra", ["#E8C070", "#FFF0C8"], ["#A07040", "#604028"], "#C4A35A", "palace"),
      plate("lmk-30", "Piazza San Marco", ["#70B8E0", "#E8F6FF"], ["#C8C0B0", "#8A8478"], "#C4A35A", "piazza")
    ],
    studio: [
      plate("stu-01", "Soft white cove", ["#F7FBFF", "#FFFFFF"], ["#EEF2F6", "#D9E1E8"], "#B8C4CE", "cove"),
      plate("stu-02", "Warm gray studio", ["#EEEAE4", "#F8F5F0"], ["#D4CDC4", "#B0A89C"], "#C4A35A", "cove"),
      plate("stu-03", "Daylight sweep", ["#E8F4FF", "#FFFFFF"], ["#DCE6F0", "#B7C4D2"], "#19C6FF", "cove"),
      plate("stu-04", "Champagne linen", ["#F6E7C8", "#FFF8EC"], ["#E4D4B4", "#C8B48C"], "#C4A35A", "lounge")
    ]
  };

  WS.SERIES = [
    { id: "dealership", label: "Dealership" },
    { id: "landscape", label: "Landscape" },
    { id: "landmark", label: "Landmark" }
  ];

  function allPlates() {
    return WS.CATALOG.dealership
      .concat(WS.CATALOG.landscape)
      .concat(WS.CATALOG.landmark)
      .concat(WS.CATALOG.studio);
  }
  WS.allPlates = allPlates;

  WS.plateById = function (id) {
    var list = allPlates();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  WS.isInterior = function (viewId) {
    return !!WS.INTERIOR[viewId];
  };

  function svgEsc(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function motifPaths(p) {
    var a = p.accent;
    switch (p.motif) {
      case "glass":
        return '<rect x="80" y="70" width="640" height="210" fill="rgba(255,255,255,.35)" stroke="' + a + '" stroke-width="6"/>' +
          '<path d="M80 140h640M240 70v210M560 70v210" stroke="rgba(255,255,255,.5)" stroke-width="3"/>';
      case "night":
        return '<rect x="120" y="90" width="80" height="180" fill="' + a + '" opacity=".35"/>' +
          '<rect x="360" y="60" width="80" height="210" fill="' + a + '" opacity=".55"/>' +
          '<rect x="600" y="100" width="80" height="170" fill="' + a + '" opacity=".4"/>';
      case "cove":
        return '<ellipse cx="400" cy="420" rx="420" ry="90" fill="rgba(255,255,255,.45)"/>';
      case "gloss":
        return '<rect x="0" y="300" width="800" height="150" fill="url(#gnd)" opacity=".95"/>' +
          '<ellipse cx="400" cy="360" rx="260" ry="18" fill="rgba(255,255,255,.18)"/>';
      case "mountain":
        return '<path d="M40 320 L180 140 L300 280 L420 90 L560 250 L700 120 L800 320 Z" fill="' + a + '" opacity=".55"/>';
      case "lake":
        return '<ellipse cx="400" cy="300" rx="300" ry="50" fill="' + a + '" opacity=".35"/>';
      case "forest":
        return '<path d="M120 320 L180 160 L240 320Z M300 320 L380 120 L460 320Z M540 320 L620 150 L700 320Z" fill="' + a + '" opacity=".55"/>';
      case "desert":
        return '<path d="M0 300 Q200 220 400 300 T800 280 V450 H0Z" fill="' + a + '" opacity=".45"/>';
      case "coast":
        return '<path d="M0 280 Q160 240 320 290 T800 260 V450 H0Z" fill="' + a + '" opacity=".4"/>';
      case "snow":
        return '<path d="M80 320 L220 80 L360 320Z M360 320 L500 60 L640 320Z" fill="#fff" opacity=".7"/>';
      case "tower":
        return '<path d="M400 70 L430 300 H370 Z" fill="' + a + '"/><rect x="392" y="300" width="16" height="40" fill="' + a + '"/>';
      case "colosseum":
        return '<ellipse cx="400" cy="250" rx="180" ry="90" fill="none" stroke="' + a + '" stroke-width="18"/>' +
          '<ellipse cx="400" cy="250" rx="120" ry="58" fill="none" stroke="' + a + '" stroke-width="10"/>';
      case "square":
        return '<rect x="80" y="80" width="90" height="200" fill="' + a + '" opacity=".7"/>' +
          '<rect x="360" y="50" width="80" height="230" fill="#FFE14A" opacity=".8"/>' +
          '<rect x="620" y="90" width="90" height="190" fill="#19C6FF" opacity=".7"/>';
      case "bridge":
        return '<path d="M40 260 Q400 80 760 260" fill="none" stroke="' + a + '" stroke-width="14"/>' +
          '<path d="M40 260 H760" stroke="' + a + '" stroke-width="8"/>';
      case "cntower":
        return '<rect x="394" y="60" width="12" height="250" fill="' + a + '"/><circle cx="400" cy="160" r="28" fill="' + a + '"/>';
      case "clock":
        return '<rect x="370" y="80" width="60" height="220" fill="' + a + '"/><circle cx="400" cy="130" r="28" fill="#fff"/>';
      case "island":
        return '<rect x="120" y="200" width="70" height="90" fill="#fff"/><rect x="210" y="180" width="70" height="110" fill="#fff"/>' +
          '<rect x="500" y="190" width="80" height="100" fill="#fff"/><ellipse cx="400" cy="310" rx="280" ry="24" fill="' + a + '" opacity=".35"/>';
      case "skyline":
        return '<rect x="80" y="140" width="50" height="180" fill="' + a + '"/><rect x="160" y="90" width="40" height="230" fill="' + a + '"/>' +
          '<rect x="230" y="160" width="70" height="160" fill="' + a + '"/><rect x="520" y="70" width="36" height="250" fill="' + a + '"/>' +
          '<rect x="580" y="120" width="80" height="200" fill="' + a + '"/>';
      case "opera":
        return '<path d="M180 300 Q400 80 620 300" fill="#fff" opacity=".85"/>';
      case "statue":
        return '<rect x="392" y="200" width="16" height="110" fill="' + a + '"/><circle cx="400" cy="170" r="22" fill="' + a + '"/>';
      case "needle":
        return '<path d="M400 50 L420 300 H380 Z" fill="' + a + '"/><ellipse cx="400" cy="180" rx="36" ry="10" fill="#fff"/>';
      case "sagrada":
        return '<path d="M280 300 L320 80 L360 300Z M400 300 L440 50 L480 300Z M520 300 L560 100 L600 300Z" fill="' + a + '"/>';
      case "redeemer":
        return '<path d="M250 170 H550 M400 80 V300" stroke="#fff" stroke-width="16" stroke-linecap="round"/>';
      case "wheel":
        return '<circle cx="400" cy="200" r="90" fill="none" stroke="' + a + '" stroke-width="10"/>' +
          '<circle cx="400" cy="200" r="8" fill="' + a + '"/>';
      case "castle":
        return '<path d="M220 300 V140 H280 V180 H360 V100 H440 V180 H520 V140 H580 V300Z" fill="' + a + '"/>';
      case "parliament":
        return '<rect x="200" y="180" width="400" height="120" fill="' + a + '"/><path d="M400 70 L460 180 H340 Z" fill="' + a + '"/>';
      case "hills":
        return '<path d="M0 280 Q200 180 400 260 T800 200 V450 H0Z" fill="' + a + '" opacity=".45"/>';
      case "table":
        return '<path d="M80 240 H720 L640 320 H160 Z" fill="' + a + '" opacity=".55"/>';
      case "temple":
        return '<rect x="220" y="200" width="360" height="100" fill="' + a + '"/><path d="M200 200 L400 90 L600 200Z" fill="' + a + '"/>';
      case "fountain":
        return '<ellipse cx="400" cy="280" rx="160" ry="30" fill="' + a + '" opacity=".4"/><rect x="388" y="160" width="24" height="120" fill="' + a + '"/>';
      case "cathedral":
        return '<path d="M260 300 V160 L400 70 L540 160 V300Z" fill="' + a + '"/>';
      case "palace":
        return '<rect x="180" y="170" width="440" height="140" fill="' + a + '"/><rect x="240" y="130" width="80" height="40" fill="' + a + '"/>' +
          '<rect x="480" y="130" width="80" height="40" fill="' + a + '"/>';
      case "piazza":
        return '<rect x="140" y="160" width="120" height="150" fill="' + a + '" opacity=".5"/>' +
          '<rect x="540" y="140" width="140" height="170" fill="' + a + '" opacity=".6"/>';
      case "canopy":
        return '<path d="M60 160 H740 L700 220 H100 Z" fill="' + a + '" opacity=".45"/>';
      case "garage":
        return '<rect x="80" y="100" width="640" height="200" fill="rgba(255,255,255,.08)" stroke="' + a + '" stroke-width="4"/>';
      case "lounge":
        return '<rect x="100" y="200" width="600" height="16" fill="' + a + '" opacity=".35"/>';
      case "marble":
        return '<path d="M0 200 Q200 160 400 200 T800 180" fill="none" stroke="#fff" stroke-width="8" opacity=".5"/>';
      case "tunnel":
        return '<path d="M80 320 Q400 40 720 320" fill="none" stroke="' + a + '" stroke-width="20"/>';
      case "wet":
        return '<path d="M0 300 Q200 280 400 310 T800 290 V450 H0Z" fill="' + a + '" opacity=".25"/>';
      case "vineyard":
      case "grove":
      case "field":
        return '<path d="M60 260 L120 320 M180 240 L240 320 M300 250 L360 320 M420 230 L480 320 M540 250 L600 320 M660 240 L720 320" stroke="' + a + '" stroke-width="10"/>';
      case "palm":
        return '<path d="M200 320 V180 M200 180 Q140 140 120 180 M200 180 Q260 130 280 180" stroke="' + a + '" stroke-width="10" fill="none"/>' +
          '<path d="M600 320 V170 M600 170 Q540 120 520 170 M600 170 Q660 110 690 170" stroke="' + a + '" stroke-width="10" fill="none"/>';
      case "canyon":
        return '<path d="M0 200 L180 320 L360 180 L540 330 L800 160 V450 H0Z" fill="' + a + '" opacity=".4"/>';
      case "fjord":
        return '<path d="M0 180 L200 320 L400 160 L600 330 L800 190 V450 H0Z" fill="' + a + '" opacity=".35"/>';
      case "glen":
      case "moss":
      case "prairie":
      case "park":
        return '<path d="M0 260 Q200 200 400 260 T800 240 V450 H0Z" fill="' + a + '" opacity=".4"/>';
      default:
        return '<rect x="60" y="220" width="680" height="10" fill="' + a + '" opacity=".25"/>';
    }
  }

  WS.plateSvg = function (p) {
    if (!p) return "";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">' +
      '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + p.sky[0] + '"/><stop offset="1" stop-color="' + p.sky[1] + '"/></linearGradient>' +
      '<linearGradient id="gnd" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + p.ground[0] + '"/><stop offset="1" stop-color="' + p.ground[1] + '"/></linearGradient></defs>' +
      '<rect width="800" height="450" fill="url(#sky)"/>' +
      '<rect y="300" width="800" height="150" fill="url(#gnd)"/>' +
      motifPaths(p) +
      '<rect x="24" y="388" width="752" height="42" rx="12" fill="rgba(10,16,28,.42)"/>' +
      '<text x="40" y="416" fill="#fff" font-family="Manrope,system-ui,sans-serif" font-size="20" font-weight="800">' +
      svgEsc(p.name) + '</text></svg>';
  };

  WS.plateDataUri = function (p) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(WS.plateSvg(p));
  };

  WS.shouldApplyBackground = function (viewId, plateId, keepBackground) {
    if (keepBackground) return false;
    if (!plateId) return false;
    var plate = WS.plateById(plateId);
    if (!plate) return false;
    if (WS.isInterior(viewId)) {
      return plate.id.indexOf("stu-") === 0 || plate.id === "dlr-04" || plate.id === "dlr-20" || plate.id === "dlr-25";
    }
    return true;
  };

  function walkFrom(files) {
    var out = {};
    WS.VIEW_ORDER.forEach(function (id) {
      var name = files[id];
      if (!name) return;
      out[id] = wiki(name);
    });
    return out;
  }

  /**
   * Five accurate website packages. Every image filename contains the
   * vehicle token (F-150, Civic, GR Corolla, CX-5, Wrangler). Slots
   * follow the live VIEWS walk order. No mismatched stock.
   */
  WS.SAMPLES = [
    {
      id: "ws-sample-f150",
      label: "2024 Ford F-150 XLT SuperCrew",
      year: "2024", make: "Ford", model: "F-150", trim: "XLT SuperCrew",
      color: "Oxford White", km: "28600", vin: "1FTFW1E50RFA44120", stock: "W-1504",
      token: "F-150",
      series: "dealership", backgroundId: "dlr-01", keepBackground: false, retouchOn: true,
      postedAtOffset: 2.1,
      photos: walkFrom({
        qfront: "2021 Ford F150 Supercrew, Front Right, 03-09-2021.jpg",
        front: "2024 Ford F-150 XLT front view.jpg",
        driver: "Ford F-150 V8 XLT 2021.jpg",
        qrear_drv: "2021 Ford F-150 SuperCrew, rear 4.28.21.jpg",
        rear: "2024 Ford F-150 XLT rear view.jpg",
        qrear_pass: "2022 Ford F-150 Supercrew, rear 5.2.22.jpg",
        pass: "Ford F-150 XLT Pickup Truck (53150027120).jpg",
        qfront_pass: "2021 Ford F-150 SuperCrew, front 4.28.21.jpg",
        dash: "2025 Ford F-150 12-inch Cluster-Off-Road drive mode.jpg",
        console: "2025 Ford F-150 PowerBoost Lariat-EV driving mode.jpg",
        tire: "Ford F-150 Lariat V8 Sport FX4 2024 (54481296733).jpg",
        interior: "2022 Ford F-150 interior.jpg"
      })
    },
    {
      id: "ws-sample-civic",
      label: "2023 Honda Civic Sport",
      year: "2023", make: "Honda", model: "Civic", trim: "Sport",
      color: "Rallye Red", km: "18000", vin: "2HGFE2F54RH543210", stock: "W-4412",
      token: "Civic",
      series: "dealership", backgroundId: "dlr-04", keepBackground: false, retouchOn: true,
      postedAtOffset: 1.4,
      photos: walkFrom({
        qfront: "2023 Honda Civic Sport Sedan in Rallye Red, front right, 2024-09-29.jpg",
        front: "23 Honda Civic Sport.jpg",
        driver: "2023 Honda Civic Sport Sedan in Rallye Red, Front Left, 04-07-2023.jpg",
        qrear_drv: "2022 Honda Civic Sport, Rear Right, 06-20-2021.jpg",
        rear: "2022 Honda Civic, rear 12.15.21.jpg",
        qrear_pass: "Honda Civic (2021) sedan Sport DSC 7057.jpg",
        pass: "Honda Civic (2021) sedan Sport DSC 7055.jpg",
        qfront_pass: "2022 Honda Civic Sport, Front Right, 06-20-2021.jpg",
        dash: "2021 Honda Civic RS 1.5 FE1 interior (20211117).jpg",
        console: "Honda Civic FE1 FL 1.5 RS Turbo interior.jpg",
        tire: "Honda Civic (2021) sedan Sport DSC 7056.jpg",
        interior: "2021 Honda Civic RS sedan (Indonesia) interior.jpg"
      })
    },
    {
      id: "ws-sample-grcorolla",
      label: "2023 Toyota GR Corolla Core",
      year: "2023", make: "Toyota", model: "GR Corolla", trim: "Core",
      color: "White", km: "10500", vin: "JTNABAAE8PA003162", stock: "A-1184",
      token: "GR Corolla",
      series: "landscape", backgroundId: "lnd-01", keepBackground: false, retouchOn: true,
      postedAtOffset: 0.6,
      photos: walkFrom({
        qfront: "2023 Toyota GR Corolla, front NYIAS 2022.jpg",
        front: "2023 Toyota GR Corolla, front NYIAS 2022.jpg",
        driver: "GRCorollaGZEA14KitaIkebukuro.jpg",
        qrear_drv: "GRCorollaGZEA14KitaIkebukuroR.jpg",
        rear: "2023 Toyota GR Corolla, rear NYIAS 2022.jpg",
        qrear_pass: "2023 Toyota GR Corolla, rear NYIAS 2022.jpg",
        pass: "GRCorollaGZEA14KitaIkebukuro.jpg",
        qfront_pass: "GRCorollaGZEA14KitaIkebukuro.jpg",
        dash: "The interior of Toyota GR COROLLA RZ (4BA-GZEA14H-BHFRZ).jpg",
        console: "Toyota GR COROLLA RZ (4BA-GZEA14H-BHFRZ) interior.jpg",
        tire: "2023 Toyota GR Corolla, front NYIAS 2022.jpg",
        interior: "2022 Toyota GR Corolla Morizo Edition (Japan) interior.png"
      })
    },
    {
      id: "ws-sample-cx5",
      label: "2017 Mazda CX-5 GT",
      year: "2017", make: "Mazda", model: "CX-5", trim: "GT",
      color: "Soul Red", km: "88000", vin: "JM3KFBDM5L0147890", stock: "W-2208",
      token: "CX-5",
      series: "landscape", backgroundId: "lnd-03", keepBackground: false, retouchOn: true,
      postedAtOffset: 4.2,
      photos: walkFrom({
        qfront: "The frontview of Mazda CX-5 XD L Package 4WD (LDA-KF2P).jpg",
        front: "Mazda CX-5 XD L Package 4WD (LDA-KF2P) front.jpg",
        driver: "Mazda CX-5 (KF) Facelift 1X7A6070.jpg",
        qrear_drv: "The rearview of Mazda CX-5 XD L Package 4WD (LDA-KF2P).jpg",
        rear: "Mazda CX-5 XD L Package 4WD (LDA-KF2P) rear.jpg",
        qrear_pass: "The rearview of Mazda CX-5 XD L Package 4WD (LDA-KF2P).jpg",
        pass: "Mazda CX-5 25S Silk Beige Selection (6BA-KF5P) front.jpg",
        qfront_pass: "Mazda CX-5 XD L Package 4WD (LDA-KF2P) front.jpg",
        dash: "Mazda CX-5 XD L Package 4WD (LDA-KF2P) interior.jpg",
        console: "Mazda CX-5 XD L Package 4WD (LDA-KF2P) interior.jpg",
        tire: "The tire wheel of Mazda CX-5 XD L Package 4WD (LDA-KF2P).jpg",
        interior: "Mazda CX-5 XD L Package 4WD (LDA-KF2P) interior.jpg"
      })
    },
    {
      id: "ws-sample-wrangler",
      label: "2024 Jeep Wrangler Unlimited Sahara",
      year: "2024", make: "Jeep", model: "Wrangler", trim: "Unlimited Sahara",
      color: "Silver Zynith", km: "14200", vin: "1C4HJXDN5RW640118", stock: "W-8810",
      token: "Wrangler",
      series: "landmark", backgroundId: "lmk-21", keepBackground: false, retouchOn: true,
      postedAtOffset: 6.5,
      photos: walkFrom({
        qfront: "2024 Jeep Wrangler four-door Sahara in Silver Zynith, front right, 2026-06-06.jpg",
        front: "2024 Jeep Wrangler Sahara Unlimited.jpg",
        driver: "Jeep Wrangler Sahara Seite.JPG",
        qrear_drv: "Jeep Wrangler Unlimited 2.2 CRDi Sahara (JL) – h 08052021.jpg",
        rear: "2024 Jeep Wrangler four-door Sahara in Silver Zynith, rear right, 2026-06-06.jpg",
        qrear_pass: "2024 Jeep Wrangler four-door Sahara in Silver Zynith, rear right, 2026-06-06.jpg",
        pass: "24 Jeep Wrangler Unlimited Sahara.jpg",
        qfront_pass: "Jeep Wrangler Unlimited 2.2 CRDi Sahara (JL) – f 08052021.jpg",
        dash: "2024 Jeep Wrangler Unlimited interior.jpg",
        console: "2023 Jeep Wrangler Unlimited interior.jpg",
        tire: "Jeep Wrangler Spare Wheel Cover Millennial Anti-Theft.jpg",
        interior: "2024 Jeep Wrangler Unlimited interior.jpg"
      })
    }
  ];

  WS.samplePhotoCount = function (sample) {
    return Object.keys((sample && sample.photos) || {}).length;
  };

  WS.assertSampleAccuracy = function (sample) {
    var token = sample.token;
    var files = sample.photos || {};
    var missing = [];
    WS.VIEW_ORDER.forEach(function (id) {
      if (!files[id]) missing.push(id);
    });
    if (missing.length) return { ok: false, reason: "missing views " + missing.join(",") };
    var label = (sample.label || "") + " " + (sample.model || "");
    if (label.toLowerCase().indexOf(token.toLowerCase()) < 0) {
      return { ok: false, reason: "label missing token " + token };
    }
    var compact = String(token || "").toLowerCase().replace(/[-_\s]/g, "");
    var bad = [];
    Object.keys(files).forEach(function (id) {
      var url = decodeURIComponent(files[id] || "").toLowerCase().replace(/[-_\s]/g, "");
      if (url.indexOf(compact) < 0) bad.push(id);
    });
    if (bad.length) return { ok: false, reason: "mismatched stock on " + bad.join(",") };
    return { ok: true };
  };

  function emptyStudio() {
    return {
      tab: "studio",
      retouchOn: true,
      keepBackground: true,
      series: "dealership",
      backgroundId: "",
      blurPlate: false,
      originals: {},
      enhanced: {},
      approved: {},
      demo: false,
      engine: "local",
      busy: false,
      fromHistory: false,
      packageId: ""
    };
  }

  function mediaKey(id) { return "inspect.webStudio.media." + id; }

  function readJson(storeGet, key, fallback) {
    try {
      var raw = storeGet ? storeGet(key) : null;
      if (!raw && typeof localStorage !== "undefined") raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }

  function writeJson(storeSet, key, val) {
    var s = JSON.stringify(val);
    if (storeSet) storeSet(key, s);
    else {
      try { localStorage.setItem(key, s); } catch (e1) {}
      try { sessionStorage.setItem(key, s); } catch (e2) {}
    }
  }

  WS.loadHistoryMeta = function (hooks) {
    hooks = hooks || {};
    var list = readJson(hooks.storeGet, WS.HISTORY_KEY, []);
    return Array.isArray(list) ? list : [];
  };

  WS.saveHistoryMeta = function (list, hooks) {
    hooks = hooks || {};
    writeJson(hooks.storeSet, WS.HISTORY_KEY, list || []);
    return list;
  };

  WS.upsertHistory = function (meta, media, hooks) {
    hooks = hooks || {};
    var list = WS.loadHistoryMeta(hooks);
    var i = -1;
    list.forEach(function (x, n) { if (x && x.id === meta.id) i = n; });
    var slim = {};
    Object.keys(meta || {}).forEach(function (k) {
      if (k !== "photos" && k !== "originals" && k !== "enhanced") slim[k] = meta[k];
    });
    slim.updatedAt = Date.now();
    slim.photoCount = slim.photoCount || (media && media.originals ? Object.keys(media.originals).length : 0);
    if (i >= 0) list[i] = Object.assign({}, list[i], slim);
    else list.unshift(slim);
    WS.saveHistoryMeta(list, hooks);
    if (hooks.idbPut && media) hooks.idbPut(mediaKey(meta.id), media);
    else writeJson(hooks.storeSet, mediaKey(meta.id), media || {});
    return slim;
  };

  WS.loadHistoryMedia = function (id, hooks) {
    hooks = hooks || {};
    if (hooks.idbGet) {
      return Promise.resolve(hooks.idbGet(mediaKey(id))).then(function (v) {
        if (v && v.originals) return v;
        return readJson(hooks.storeGet, mediaKey(id), { originals: {}, enhanced: {}, approved: {} });
      });
    }
    return Promise.resolve(readJson(hooks.storeGet, mediaKey(id), { originals: {}, enhanced: {}, approved: {} }));
  };

  function daysAgo(n) { return Date.now() - Math.round(n * 86400000); }

  WS.sampleToHistory = function (sample) {
    var posted = daysAgo(sample.postedAtOffset || 1);
    return {
      id: sample.id,
      sample: true,
      sampleVer: WS.SAMPLE_VER,
      label: sample.label,
      year: sample.year, make: sample.make, model: sample.model, trim: sample.trim,
      color: sample.color, km: sample.km, vin: sample.vin, stock: sample.stock,
      token: sample.token,
      retouchOn: sample.retouchOn !== false,
      keepBackground: !!sample.keepBackground,
      series: sample.series || "dealership",
      backgroundId: sample.backgroundId || "",
      blurPlate: false,
      status: "posted",
      createdAt: posted,
      updatedAt: posted,
      postedAt: posted,
      photoCount: WS.samplePhotoCount(sample),
      thumb: sample.photos.qfront || sample.photos.front || ""
    };
  };

  WS.seedSamples = function (hooks) {
    hooks = hooks || {};
    var list = WS.loadHistoryMeta(hooks);
    var stale = list.some(function (x) { return x && x.sample && x.sampleVer !== WS.SAMPLE_VER; });
    if (stale) list = list.filter(function (x) { return !(x && x.sample && x.sampleVer !== WS.SAMPLE_VER); });
    var have = {};
    list.forEach(function (x) { if (x && x.id) have[x.id] = true; });
    var added = 0;
    WS.SAMPLES.forEach(function (s) {
      if (have[s.id]) return;
      var meta = WS.sampleToHistory(s);
      list.push(meta);
      var originals = {};
      var approved = {};
      Object.keys(s.photos).forEach(function (id) {
        originals[id] = s.photos[id];
        approved[id] = true;
      });
      if (hooks.idbPut) hooks.idbPut(mediaKey(s.id), { originals: originals, enhanced: {}, approved: approved });
      else writeJson(hooks.storeSet, mediaKey(s.id), { originals: originals, enhanced: {}, approved: approved });
      added++;
    });
    list.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    if (stale || added) WS.saveHistoryMeta(list, hooks);
    return list;
  };

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      if (typeof Image === "undefined") return reject(new Error("no Image"));
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("img")); };
      img.src = src;
    });
  }

  function makeCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  function drawCover(ctx, img, w, h) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var t = w / h;
    var sx = 0, sy = 0, sw = iw, sh = ih;
    if (iw / ih > t) { sw = ih * t; sx = (iw - sw) / 2; }
    else { sh = iw / t; sy = (ih - sh) / 2; }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  }

  function drawContainLower(ctx, img, w, h, scale) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    scale = scale || 0.86;
    var maxW = w * scale;
    var maxH = h * 0.72;
    var r = Math.min(maxW / iw, maxH / ih);
    var dw = iw * r, dh = ih * r;
    var dx = (w - dw) / 2;
    var dy = h - dh - h * 0.08;
    ctx.save();
    ctx.fillStyle = "rgba(8,10,16,.35)";
    ctx.beginPath();
    ctx.ellipse(w / 2, dy + dh - 8, dw * 0.42, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  function blurPlateRegion(ctx, w, h) {
    var x = Math.round(w * 0.38);
    var y = Math.round(h * 0.62);
    var bw = Math.round(w * 0.24);
    var bh = Math.round(h * 0.1);
    try {
      var data = ctx.getImageData(x, y, bw, bh);
      var copy = new Uint8ClampedArray(data.data);
      var r = 6;
      for (var py = 0; py < bh; py++) {
        for (var px = 0; px < bw; px++) {
          var rs = 0, gs = 0, bs = 0, n = 0;
          for (var oy = -r; oy <= r; oy += 2) {
            for (var ox = -r; ox <= r; ox += 2) {
              var xx = px + ox, yy = py + oy;
              if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) continue;
              var i = (yy * bw + xx) * 4;
              rs += copy[i]; gs += copy[i + 1]; bs += copy[i + 2]; n++;
            }
          }
          var o = (py * bw + px) * 4;
          data.data[o] = rs / n; data.data[o + 1] = gs / n; data.data[o + 2] = bs / n;
        }
      }
      ctx.putImageData(data, x, y);
    } catch (e) {}
  }

  async function localItem(item, opts) {
    opts = opts || {};
    var w = 1600, h = 900;
    var c = makeCanvas(w, h);
    var ctx = c.getContext("2d");
    var img;
    try { img = await loadImage(item.data); }
    catch (e) { return { id: item.id, data: item.data, engine: "local", skipped: true }; }
    var applyBg = WS.shouldApplyBackground(item.view || item.id, opts.backgroundId, opts.keepBackground);
    if (applyBg) {
      var plate = WS.plateById(opts.backgroundId);
      if (plate) {
        try {
          var bg = await loadImage(WS.plateDataUri(plate));
          drawCover(ctx, bg, w, h);
        } catch (e2) {
          ctx.fillStyle = "#e8f4ff";
          ctx.fillRect(0, 0, w, h);
        }
      }
      if (opts.retouchOn !== false && ctx.filter !== undefined) {
        ctx.filter = "contrast(1.14) saturate(1.08) brightness(1.06)";
      }
      drawContainLower(ctx, img, w, h, WS.isInterior(item.view || item.id) ? 0.92 : 0.86);
      ctx.filter = "none";
    } else {
      if (opts.retouchOn !== false && ctx.filter !== undefined) {
        ctx.filter = "contrast(1.14) saturate(1.08) brightness(1.06)";
      } else {
        ctx.filter = "none";
      }
      drawCover(ctx, img, w, h);
      ctx.filter = "none";
    }
    if (opts.blurPlate && !WS.isInterior(item.view || item.id)) blurPlateRegion(ctx, w, h);
    return { id: item.id, data: c.toDataURL("image/jpeg", 0.86), engine: "local" };
  }

  async function tryRemote(payload) {
    var urls = [];
    if (root.PHOTO_ENHANCE_URL) urls.push(root.PHOTO_ENHANCE_URL);
    urls.push("/api/photo-enhance");
    for (var i = 0; i < urls.length; i++) {
      try {
        var r = await fetch(urls[i], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!r.ok) continue;
        var j = await r.json();
        if (j && j.photos && j.photos.length) return j;
      } catch (e) {}
    }
    return null;
  }

  WS.processPhotos = async function (opts) {
    opts = opts || {};
    var items = opts.items || opts.photos || [];
    var remote = await tryRemote({
      mode: opts.mode || "both",
      backgroundId: opts.backgroundId || "",
      blurPlate: !!opts.blurPlate,
      keepBackground: !!opts.keepBackground,
      prompt: WS.DAMAGE_STAYS_PROMPT,
      photos: items.map(function (it) {
        return { id: it.id, view: it.view || it.id, kind: it.kind || "walk", data: it.data };
      })
    });
    if (remote && remote.photos && remote.photos.length) {
      return { engine: remote.engine || "remote", photos: remote.photos };
    }
    var out = [];
    for (var i = 0; i < items.length; i++) {
      if (opts.localEngine) out.push(await opts.localEngine(items[i], opts));
      else if (typeof document !== "undefined") out.push(await localItem(items[i], opts));
      else out.push({ id: items[i].id, data: items[i].data, engine: "local-stub" });
    }
    return { engine: "local", photos: out };
  };

  function $(id) {
    return typeof document !== "undefined" ? document.getElementById(id) : null;
  }

  function hooks() {
    return {
      storeGet: root.storeGet,
      storeSet: root.storeSet,
      idbPut: root.idbPut,
      idbGet: root.idbGet
    };
  }

  function views() {
    return WS.VIEW_ORDER.slice();
  }

  function viewLabel(id) {
    var list = root.VIEWS || [];
    for (var i = 0; i < list.length; i++) if (list[i][0] === id) return (i + 1) + " · " + list[i][1];
    var idx = WS.VIEW_ORDER.indexOf(id);
    var name = WS.VIEW_LABELS[id] || id;
    return (idx >= 0 ? (idx + 1) + " · " : "") + name;
  }

  function picFor(id) {
    var list = root.VIEWS || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i][0] === id && typeof root.pic === "function") return root.pic(list[i][2]);
    }
    return "";
  }

  function studioState() {
    var APP = root.APP;
    if (!APP.webStudio) APP.webStudio = emptyStudio();
    return APP.webStudio;
  }

  function collectOriginals() {
    var APP = root.APP;
    var st = studioState();
    var originals = {};
    var demo = true;
    views().forEach(function (id) {
      if (APP.photos && APP.photos[id]) {
        originals[id] = APP.photos[id];
        demo = false;
      } else if (st.originals[id]) {
        originals[id] = st.originals[id];
        if (String(originals[id]).indexOf("ghosts/") < 0) demo = false;
      } else {
        originals[id] = picFor(id);
      }
    });
    st.originals = originals;
    st.demo = demo && !st.fromHistory;
    return originals;
  }

  function unitName() {
    if (typeof root.unitLabel === "function" && root.unitLabel() !== "Unit") return root.unitLabel();
    var APP = root.APP || {};
    var bits = [APP.year, APP.make, APP.model].filter(Boolean);
    return bits.length ? bits.join(" ") : "Website unit";
  }

  function paintEngineBadge() {
    var el = $("wsEngineBadge");
    var st = studioState();
    if (!el) return;
    el.textContent = st.engine === "remote"
      ? "Live enhance"
      : "Demo mode · local enhance";
  }

  function paintSteps() {
    var st = studioState();
    var host = $("wsSteps");
    if (!host) return;
    var hasBg = !st.keepBackground && st.backgroundId;
    var approved = Object.keys(st.approved || {}).filter(function (k) { return st.approved[k]; }).length;
    var total = Object.keys(st.originals || {}).length || 12;
    var items = [
      { id: "retouch", label: "Retouch", on: st.retouchOn },
      { id: "bg", label: "Background", on: hasBg },
      { id: "ok", label: "Approve", on: approved > 0 },
      { id: "post", label: "Post", on: approved >= total && total > 0 }
    ];
    host.innerHTML = items.map(function (it) {
      return '<li class="' + (it.on ? "on" : "") + '">' + it.label + "</li>";
    }).join("");
  }

  function paintSeries() {
    var st = studioState();
    var host = $("wsSeries");
    if (!host) return;
    host.innerHTML = WS.SERIES.map(function (s) {
      return '<button type="button" class="ws-chip' + (st.series === s.id ? " on" : "") + '" data-ws-series="' + s.id + '">' + s.label + "</button>";
    }).join("");
  }

  function paintPlates() {
    var st = studioState();
    var host = $("wsPlateGrid");
    if (!host) return;
    var list = (WS.CATALOG[st.series] || []).slice();
    host.innerHTML = list.map(function (p) {
      return '<button type="button" class="ws-plate' + (st.backgroundId === p.id ? " on" : "") + '" data-ws-plate="' + p.id + '">' +
        '<img alt="" src="' + WS.plateDataUri(p) + '"><span>' + p.name + "</span></button>";
    }).join("");
  }

  function paintPhotos() {
    var st = studioState();
    var host = $("wsPhotoList");
    if (!host) return;
    collectOriginals();
    var ids = views();
    if (!ids.length) {
      host.innerHTML = '<p class="quote">No walk-around slots.</p>';
      return;
    }
    host.innerHTML = ids.map(function (id) {
      var before = st.originals[id] || "";
      var after = st.enhanced[id] || before;
      var ok = !!st.approved[id];
      var interior = WS.isInterior(id);
      return '<article class="ws-shot' + (ok ? " ok" : "") + '" data-ws-shot="' + id + '">' +
        '<header><b>' + viewLabel(id) + "</b>" +
        (interior ? '<em>Interior · retouch clean, studio only</em>' : "<em>Exterior</em>") +
        (ok ? '<span class="ws-ok">Approved</span>' : "") + "</header>" +
        '<div class="ws-ba">' +
        '<figure><img src="' + before + '" alt="Before"><figcaption>Before</figcaption></figure>' +
        '<figure><img src="' + after + '" alt="After"><figcaption>After</figcaption></figure>' +
        "</div>" +
        '<div class="ws-shot-actions">' +
        '<button type="button" class="pill wash" data-ws-do="one" data-id="' + id + '">Enhance this</button>' +
        '<button type="button" class="pill cyan" data-ws-do="approve" data-id="' + id + '">' + (ok ? "Approved" : "Approve") + "</button>" +
        "</div></article>";
    }).join("");
  }

  function formatWhen(ts) {
    try {
      return new Date(ts).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
    } catch (e) { return ""; }
  }

  function plateName(id) {
    var p = WS.plateById(id);
    return p ? p.name : "Real background";
  }

  function paintHistory() {
    var host = $("wsHistoryList");
    if (!host) return;
    WS.seedSamples(hooks());
    var list = WS.loadHistoryMeta(hooks());
    if (!list.length) {
      host.innerHTML = '<p class="quote">Nothing posted yet. Enhance a walk-around and save — it will live here.</p>';
      return;
    }
    host.innerHTML = list.map(function (it) {
      return '<button type="button" class="ws-hist" data-ws-open="' + it.id + '">' +
        '<img src="' + (it.thumb || "") + '" alt="">' +
        "<div><b>" + (it.label || "Website unit") + "</b>" +
        "<span>" + (it.status === "posted" ? "Posted" : "Saved") + " · " + formatWhen(it.updatedAt || it.postedAt) + "</span>" +
        "<em>" + plateName(it.backgroundId) + " · " + (it.photoCount || 0) + " photos</em></div></button>";
    }).join("");
  }

  function paintToggles() {
    var st = studioState();
    var ret = $("wsRetouch");
    if (ret) ret.checked = st.retouchOn !== false;
    var keep = $("wsKeepBg");
    var apply = $("wsApplyBg");
    if (keep) keep.checked = !!st.keepBackground;
    if (apply) apply.checked = !st.keepBackground;
    var blur = $("wsBlurPlate");
    if (blur) blur.checked = !!st.blurPlate;
    var post = $("wsPost");
    if (post) post.textContent = st.fromHistory ? "Resend to website" : "Post to website";
  }

  function paintTabs() {
    var st = studioState();
    document.querySelectorAll("[data-ws-tab]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-ws-tab") === st.tab);
    });
    if ($("wsStudioPane")) $("wsStudioPane").classList.toggle("hide", st.tab !== "studio");
    if ($("wsHistoryPane")) $("wsHistoryPane").classList.toggle("hide", st.tab !== "history");
  }

  WS.paint = function () {
    if (!$("webStudio")) return;
    collectOriginals();
    paintTabs();
    paintToggles();
    paintEngineBadge();
    paintSteps();
    paintSeries();
    paintPlates();
    paintPhotos();
    paintHistory();
    var lock = $("wsLock");
    if (lock) lock.textContent = WS.DAMAGE_COPY;
    var sub = $("wsHeroSub");
    if (sub) sub.textContent = unitName();
  };

  function applyVehicle(meta) {
    var APP = root.APP;
    APP.purpose = "website";
    ["year", "make", "model", "trim", "color", "km", "vin", "stock"].forEach(function (k) {
      if (meta[k] != null) APP[k] = meta[k];
    });
    if (typeof root.applyMode === "function") root.applyMode();
  }

  async function openPackage(id) {
    var list = WS.loadHistoryMeta(hooks());
    var meta = list.filter(function (x) { return x && x.id === id; })[0];
    var sample = WS.SAMPLES.filter(function (s) { return s.id === id; })[0];
    var media = await WS.loadHistoryMedia(id, hooks());
    if ((!media || !media.originals || !Object.keys(media.originals).length) && sample) {
      media = { originals: sample.photos, enhanced: {}, approved: {} };
      Object.keys(sample.photos).forEach(function (k) { media.approved[k] = true; });
    }
    if (!meta && sample) meta = WS.sampleToHistory(sample);
    if (!meta) return;
    applyVehicle(meta);
    var APP = root.APP;
    APP.photos = Object.assign({}, (media && media.originals) || {});
    APP.webStudioId = meta.id;
    APP.webStudio = emptyStudio();
    var st = APP.webStudio;
    st.originals = Object.assign({}, (media && media.originals) || {});
    st.enhanced = Object.assign({}, (media && media.enhanced) || {});
    st.approved = Object.assign({}, (media && media.approved) || {});
    st.retouchOn = meta.retouchOn !== false;
    st.keepBackground = !!meta.keepBackground;
    st.series = meta.series || "dealership";
    st.backgroundId = meta.backgroundId || "";
    st.blurPlate = !!meta.blurPlate;
    st.fromHistory = true;
    st.packageId = meta.id;
    st.tab = "studio";
    st.demo = false;
    WS.paint();
    if (typeof root.toast === "function") root.toast("Opened " + (meta.label || "package") + ". Change the plate, re-retouch, approve, resend.");
    if (st.retouchOn && !Object.keys(st.enhanced).length) runEnhance();
  }

  function currentMeta(status) {
    var APP = root.APP;
    var st = studioState();
    var id = st.packageId || APP.webStudioId || ("ws" + Date.now().toString(36));
    st.packageId = id;
    APP.webStudioId = id;
    return {
      id: id,
      label: unitName(),
      year: APP.year, make: APP.make, model: APP.model, trim: APP.trim,
      color: APP.color, km: APP.km, vin: APP.vin, stock: APP.stock,
      retouchOn: st.retouchOn !== false,
      keepBackground: !!st.keepBackground,
      series: st.series,
      backgroundId: st.backgroundId,
      blurPlate: !!st.blurPlate,
      status: status || "saved",
      createdAt: Date.now(),
      postedAt: status === "posted" ? Date.now() : "",
      photoCount: Object.keys(st.originals || {}).length,
      thumb: st.enhanced.qfront || st.originals.qfront || st.enhanced.front || st.originals.front || ""
    };
  }

  function persist(status) {
    var st = studioState();
    var meta = currentMeta(status);
    WS.upsertHistory(meta, {
      originals: st.originals,
      enhanced: st.enhanced,
      approved: st.approved
    }, hooks());
    return meta;
  }

  async function runEnhance(ids) {
    var st = studioState();
    if (st.busy) return;
    collectOriginals();
    var want = (ids && ids.length) ? ids : views();
    if (st.keepBackground === false && !st.backgroundId) {
      if (typeof root.toast === "function") root.toast("Pick a background plate or keep the real one.");
    }
    st.busy = true;
    if (typeof root.toast === "function") root.toast("Retouching — dirt goes, damage stays.");
    var items = want.map(function (id) {
      return { id: id, view: id, kind: "walk", data: st.originals[id] };
    }).filter(function (it) { return it.data; });
    try {
      var res = await WS.processPhotos({
        mode: st.keepBackground ? "retouch" : "both",
        backgroundId: st.backgroundId,
        keepBackground: st.keepBackground,
        blurPlate: st.blurPlate,
        retouchOn: st.retouchOn,
        items: items
      });
      st.engine = res.engine || "local";
      (res.photos || []).forEach(function (p) {
        if (p && p.id && p.data) {
          st.enhanced[p.id] = p.data;
          st.approved[p.id] = false;
        }
      });
      if (typeof root.toast === "function") root.toast(st.engine === "remote" ? "Enhanced." : "Local enhance ready — approve the afters.");
    } catch (e) {
      if (typeof root.toast === "function") root.toast("Couldn’t enhance — try again.");
    }
    st.busy = false;
    WS.paint();
  }

  function approveAll() {
    var st = studioState();
    views().forEach(function (id) {
      if (!st.enhanced[id]) st.enhanced[id] = st.originals[id];
      st.approved[id] = true;
    });
    WS.paint();
    if (typeof root.toast === "function") root.toast("All photos approved.");
  }

  function applyApprovedToApp() {
    var APP = root.APP;
    var st = studioState();
    views().forEach(function (id) {
      var src = st.enhanced[id] || st.originals[id];
      if (src) APP.photos[id] = src;
    });
  }

  function goPost() {
    var st = studioState();
    var pending = views().filter(function (id) { return !st.approved[id]; });
    if (pending.length) {
      if (typeof root.toast === "function") root.toast("Approve each photo first — then post.");
      return;
    }
    applyApprovedToApp();
    persist("posted");
    if (typeof root.show === "function") root.show("submit");
    if (typeof root.toast === "function") root.toast(st.fromHistory ? "Ready to resend." : "Ready to post.");
  }

  WS.open = function (tab) {
    var APP = root.APP;
    if (!APP.webStudio || !APP.webStudio.packageId) APP.webStudio = emptyStudio();
    if (tab) APP.webStudio.tab = tab;
    WS.seedSamples(hooks());
    collectOriginals();
    if (typeof root.show === "function") root.show("webStudio");
    WS.paint();
    var st = APP.webStudio;
    if (st.tab === "studio" && st.retouchOn && !Object.keys(st.enhanced).length) {
      runEnhance();
    }
  };

  WS.bind = function () {
    if (!$("webStudio") || $("webStudio")._bound) return;
    $("webStudio")._bound = true;
    if ($("webStudioX")) $("webStudioX").onclick = function () {
      if (typeof root.pageClose === "function") { root.pageClose(); return; }
      if (typeof root.show === "function") root.show("photos");
    };
    document.querySelectorAll("[data-ws-tab]").forEach(function (b) {
      b.onclick = function () {
        studioState().tab = b.getAttribute("data-ws-tab");
        WS.paint();
      };
    });
    if ($("wsRetouch")) $("wsRetouch").onchange = function () {
      studioState().retouchOn = !!this.checked;
      paintSteps();
    };
    if ($("wsKeepBg")) $("wsKeepBg").onchange = function () {
      if (this.checked) {
        studioState().keepBackground = true;
        if ($("wsApplyBg")) $("wsApplyBg").checked = false;
      }
      paintSteps();
    };
    if ($("wsApplyBg")) $("wsApplyBg").onchange = function () {
      if (this.checked) {
        studioState().keepBackground = false;
        if ($("wsKeepBg")) $("wsKeepBg").checked = false;
      }
      paintSteps();
    };
    if ($("wsBlurPlate")) $("wsBlurPlate").onchange = function () {
      studioState().blurPlate = !!this.checked;
    };
    if ($("wsSeries")) $("wsSeries").addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("[data-ws-series]");
      if (!b) return;
      studioState().series = b.getAttribute("data-ws-series");
      paintSeries();
      paintPlates();
    });
    if ($("wsPlateGrid")) $("wsPlateGrid").addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("[data-ws-plate]");
      if (!b) return;
      var st = studioState();
      st.backgroundId = b.getAttribute("data-ws-plate");
      st.keepBackground = false;
      if ($("wsKeepBg")) $("wsKeepBg").checked = false;
      if ($("wsApplyBg")) $("wsApplyBg").checked = true;
      paintPlates();
      paintSteps();
    });
    if ($("wsPhotoList")) $("wsPhotoList").addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("[data-ws-do]");
      if (!b) return;
      var id = b.getAttribute("data-id");
      var act = b.getAttribute("data-ws-do");
      if (act === "one") runEnhance([id]);
      if (act === "approve") {
        var st = studioState();
        if (!st.enhanced[id]) st.enhanced[id] = st.originals[id];
        st.approved[id] = true;
        WS.paint();
      }
    });
    if ($("wsHistoryList")) $("wsHistoryList").addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("[data-ws-open]");
      if (!b) return;
      openPackage(b.getAttribute("data-ws-open"));
    });
    if ($("wsRetouchAll")) $("wsRetouchAll").onclick = function () { runEnhance(); };
    if ($("wsBgAll")) $("wsBgAll").onclick = function () {
      var st = studioState();
      st.keepBackground = false;
      if (!st.backgroundId) {
        if (typeof root.toast === "function") root.toast("Tap a plate first.");
        return;
      }
      var exteriors = views().filter(function (id) { return !WS.isInterior(id); });
      runEnhance(exteriors);
    };
    if ($("wsSaveHist")) $("wsSaveHist").onclick = function () {
      persist("saved");
      studioState().tab = "history";
      WS.paint();
      if (typeof root.toast === "function") root.toast("Saved to History.");
    };
    if ($("wsApproveAll")) $("wsApproveAll").onclick = approveAll;
    if ($("wsPost")) $("wsPost").onclick = goPost;
    if ($("webHistJump")) $("webHistJump").onclick = function () { WS.open("history"); };
  };

  WS.emptyStudio = emptyStudio;
  WS.openPackage = openPackage;
  WS.persist = persist;
  root.WebStudio = WS;
  if (typeof module !== "undefined" && module.exports) module.exports = WS;
})(typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : this);
