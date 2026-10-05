const DATA_META = {
  season: "2026/27",
  generatedAt: "2026-10-05",
  playerCoverage: "verified-active-seed",
  priceNote: "Gebalanceerde fantasy-prijzen voor een budget van €100M"
};

const CLUBS = [
  "Cercle Brugge","Club Brugge","KAA Gent","KRC Genk","KV Kortrijk","KV Mechelen",
  "KVC Westerlo","Lommel SK","OH Leuven","RAAL La Louvière","Royal Antwerp FC",
  "Royale Union Saint-Gilloise","RSC Anderlecht","SK Beveren","Sporting Charleroi",
  "Standard de Liège","STVV","SV Zulte Waregem"
];

const PLAYERS = [
  // Cercle Brugge
  {id:"cer-coucke",name:"Gaëtan Coucke",club:"Cercle Brugge",pos:"GK",minutes:630,price:7.0},
  {id:"cer-kondo",name:"Geoffrey Kondo",club:"Cercle Brugge",pos:"DEF",minutes:630,price:7.5},
  {id:"cer-konate",name:"Valy Konaté",club:"Cercle Brugge",pos:"DEF",minutes:589,price:7.0},
  {id:"cer-diakite",name:"Ibrahim Diakité",club:"Cercle Brugge",pos:"DEF",minutes:481,price:6.0},
  {id:"cer-magnee",name:"Gary Magnée",club:"Cercle Brugge",pos:"MID",minutes:603,price:8.0},
  {id:"cer-mondele",name:"Lukas Mondele",club:"Cercle Brugge",pos:"MID",minutes:569,price:7.0},
  {id:"cer-ngoura",name:"Steve Ngoura",club:"Cercle Brugge",pos:"FWD",minutes:479,price:8.0},
  {id:"cer-vanzeir",name:"Dante Vanzeir",club:"Cercle Brugge",pos:"FWD",minutes:392,price:8.5},

  // Club Brugge
  {id:"clu-sommer",name:"Yann Sommer",club:"Club Brugge",pos:"GK",minutes:630,price:12.0},
  {id:"clu-hanbeom",name:"Lee Han-beom",club:"Club Brugge",pos:"DEF",minutes:630,price:9.0},
  {id:"clu-mechele",name:"Brandon Mechele",club:"Club Brugge",pos:"DEF",minutes:630,price:10.0},
  {id:"clu-seys",name:"Joaquin Seys",club:"Club Brugge",pos:"DEF",minutes:618,price:12.0},
  {id:"clu-potts",name:"Freddie Potts",club:"Club Brugge",pos:"MID",minutes:615,price:10.0},
  {id:"clu-vetlesen",name:"Hugo Vetlesen",club:"Club Brugge",pos:"MID",minutes:545,price:11.0},
  {id:"clu-vanaken",name:"Hans Vanaken",club:"Club Brugge",pos:"MID",minutes:532,price:17.5},
  {id:"clu-tresoldi",name:"Nicolo Tresoldi",club:"Club Brugge",pos:"FWD",minutes:526,price:13.5},

  // KAA Gent
  {id:"gen-roef",name:"Davy Roef",club:"KAA Gent",pos:"GK",minutes:630,price:8.0},
  {id:"gen-vanderheyden",name:"Siebe Van Der Heyden",club:"KAA Gent",pos:"DEF",minutes:630,price:8.5},
  {id:"gen-araujo",name:"Tiago Araújo",club:"KAA Gent",pos:"DEF",minutes:628,price:9.0},
  {id:"gen-burgess",name:"Christian Burgess",club:"KAA Gent",pos:"DEF",minutes:585,price:9.0},
  {id:"gen-ngom",name:"Mouhamed El Bachir Ngom",club:"KAA Gent",pos:"DEF",minutes:566,price:7.0},
  {id:"gen-sonko",name:"Momodou Sonko",club:"KAA Gent",pos:"MID",minutes:549,price:9.0},
  {id:"gen-lopes",name:"Leonardo da Silva Lopes",club:"KAA Gent",pos:"MID",minutes:359,price:7.0},
  {id:"gen-vergara",name:"Josúe Vergara",club:"KAA Gent",pos:"FWD",minutes:528,price:10.0},

  // KRC Genk
  {id:"krg-brughmans",name:"Lucca Brughmans",club:"KRC Genk",pos:"GK",minutes:630,price:7.5},
  {id:"krg-kongolo",name:"Josué Kongolo",club:"KRC Genk",pos:"DEF",minutes:630,price:9.0},
  {id:"krg-kayembe",name:"Joris Kayembe",club:"KRC Genk",pos:"DEF",minutes:585,price:9.5},
  {id:"krg-heynen",name:"Bryan Heynen",club:"KRC Genk",pos:"MID",minutes:621,price:14.0},
  {id:"krg-durosinmi",name:"Rafiu Durosinmi",club:"KRC Genk",pos:"FWD",minutes:null,price:16.0},

  // KV Kortrijk
  {id:"kor-ilic",name:"Marko Ilić",club:"KV Kortrijk",pos:"GK",minutes:null,price:5.0},
  {id:"kor-mehssatou",name:"Nayel Mehssatou",club:"KV Kortrijk",pos:"DEF",minutes:346,price:5.5},
  {id:"kor-dejaegere",name:"Brecht Dejaegere",club:"KV Kortrijk",pos:"MID",minutes:null,price:6.5},
  {id:"kor-roche",name:"Jamie Roche",club:"KV Kortrijk",pos:"MID",minutes:null,price:5.5},
  {id:"kor-campbell",name:"Shandre Campbell",club:"KV Kortrijk",pos:"FWD",minutes:null,price:5.5},

  // KV Mechelen
  {id:"mec-miras",name:"Nacho Miras",club:"KV Mechelen",pos:"GK",minutes:540,price:7.0},
  {id:"mec-marsa",name:"José Marsà",club:"KV Mechelen",pos:"DEF",minutes:512,price:7.5},
  {id:"mec-marijnissen",name:"Luc Marijnissen",club:"KV Mechelen",pos:"DEF",minutes:434,price:6.0},
  {id:"mec-decoene",name:"Massimo Decoene",club:"KV Mechelen",pos:"DEF",minutes:272,price:5.0},
  {id:"mec-hammer",name:"Fredrik Hammer",club:"KV Mechelen",pos:"MID",minutes:495,price:7.5},
  {id:"mec-praet",name:"Dennis Praet",club:"KV Mechelen",pos:"MID",minutes:484,price:12.0},
  {id:"mec-koudou",name:"Therence Koudou",club:"KV Mechelen",pos:"MID",minutes:439,price:7.0},
  {id:"mec-vanbrederode",name:"Myron van Brederode",club:"KV Mechelen",pos:"FWD",minutes:540,price:10.0},

  // Westerlo
  {id:"wes-jungdal",name:"Andreas Jungdal",club:"KVC Westerlo",pos:"GK",minutes:630,price:7.5},
  {id:"wes-kimura",name:"Seiji Kimura",club:"KVC Westerlo",pos:"DEF",minutes:630,price:8.0},
  {id:"wes-oureaga",name:"Dago Ourega",club:"KVC Westerlo",pos:"DEF",minutes:593,price:7.5},
  {id:"wes-lapage",name:"Amando Lapage",club:"KVC Westerlo",pos:"DEF",minutes:523,price:7.0},
  {id:"wes-sandra",name:"Cisse Sandra",club:"KVC Westerlo",pos:"MID",minutes:630,price:9.0},
  {id:"wes-fofana",name:"Ibrahim Fofana",club:"KVC Westerlo",pos:"MID",minutes:563,price:8.0},
  {id:"wes-saito",name:"Shunsuke Saito",club:"KVC Westerlo",pos:"MID",minutes:513,price:7.5},
  {id:"wes-bassette",name:"Norman Bassette",club:"KVC Westerlo",pos:"FWD",minutes:489,price:10.0},

  // Lommel
  {id:"lom-pieklak",name:"Matthias Pieklak",club:"Lommel SK",pos:"GK",minutes:540,price:5.5},
  {id:"lom-vanduiven",name:"Jason Van Duiven",club:"Lommel SK",pos:"DEF",minutes:540,price:5.5},
  {id:"lom-wouters",name:"Dries Wouters",club:"Lommel SK",pos:"DEF",minutes:475,price:5.5},
  {id:"lom-eyoma",name:"Timothy Eyoma",club:"Lommel SK",pos:"DEF",minutes:515,price:5.5},
  {id:"lom-pelupessy",name:"Joey Pelupessy",club:"Lommel SK",pos:"MID",minutes:540,price:6.0},
  {id:"lom-schoofs",name:"Lucas Schoofs",club:"Lommel SK",pos:"MID",minutes:540,price:6.5},
  {id:"lom-appuah",name:"Stredair Appuah",club:"Lommel SK",pos:"MID",minutes:403,price:6.0},

  // OH Leuven
  {id:"ohl-heuvel",name:"Dani van den Heuvel",club:"OH Leuven",pos:"GK",minutes:630,price:7.0},
  {id:"ohl-dussenne",name:"Noë Dussenne",club:"OH Leuven",pos:"DEF",minutes:600,price:8.0},
  {id:"ohl-pletinckx",name:"Ewoud Pletinckx",club:"OH Leuven",pos:"DEF",minutes:450,price:7.0},
  {id:"ohl-gil",name:"Óscar Gil",club:"OH Leuven",pos:"MID",minutes:583,price:7.5},
  {id:"ohl-george",name:"Wouter George",club:"OH Leuven",pos:"MID",minutes:577,price:7.5},
  {id:"ohl-schrijvers",name:"Siebe Schrijvers",club:"OH Leuven",pos:"FWD",minutes:519,price:9.0},

  // RAAL La Louvière
  {id:"raal-peano",name:"Marcos Peano",club:"RAAL La Louvière",pos:"GK",minutes:621,price:6.5},
  {id:"raal-nkoa",name:"Patrick Nkoa",club:"RAAL La Louvière",pos:"DEF",minutes:524,price:6.5},
  {id:"raal-okou",name:"Yllan Okou",club:"RAAL La Louvière",pos:"DEF",minutes:520,price:6.0},
  {id:"raal-faye",name:"Wagane Faye",club:"RAAL La Louvière",pos:"DEF",minutes:496,price:6.0},
  {id:"raal-coulibaly",name:"Ismaila Cheick Coulibaly",club:"RAAL La Louvière",pos:"MID",minutes:629,price:8.5},
  {id:"raal-delos",name:"Shaquil Delos",club:"RAAL La Louvière",pos:"MID",minutes:613,price:7.0},
  {id:"raal-isah",name:"Mustapha Isah",club:"RAAL La Louvière",pos:"FWD",minutes:557,price:13.5},

  // Royal Antwerp
  {id:"ant-nozawa",name:"Taishi Nozawa",club:"Royal Antwerp FC",pos:"GK",minutes:630,price:7.0},
  {id:"ant-tsunashima",name:"Yuto Tsunashima",club:"Royal Antwerp FC",pos:"DEF",minutes:540,price:7.5},
  {id:"ant-vanhelden",name:"Rein Van Helden",club:"Royal Antwerp FC",pos:"DEF",minutes:450,price:7.0},
  {id:"ant-somers",name:"Thibo Somers",club:"Royal Antwerp FC",pos:"MID",minutes:524,price:10.0},
  {id:"ant-dierckx",name:"Xander Dierckx",club:"Royal Antwerp FC",pos:"MID",minutes:481,price:7.5},
  {id:"ant-fofana",name:"Modibo Fofana",club:"Royal Antwerp FC",pos:"FWD",minutes:401,price:8.0},
  {id:"ant-scott",name:"Christopher Scott",club:"Royal Antwerp FC",pos:"FWD",minutes:329,price:7.5},
  {id:"ant-frey",name:"Michael Frey",club:"Royal Antwerp FC",pos:"FWD",minutes:542,price:11.0},

  // Union SG
  {id:"usg-koffi",name:"Hervé Koffi",club:"Royale Union Saint-Gilloise",pos:"GK",minutes:540,price:11.0},
  {id:"usg-sylla",name:"Massire Sylla",club:"Royale Union Saint-Gilloise",pos:"DEF",minutes:540,price:9.0},
  {id:"usg-macallister",name:"Kevin Mac Allister",club:"Royale Union Saint-Gilloise",pos:"DEF",minutes:517,price:10.0},
  {id:"usg-kricfalusi",name:"Ondřej Kričfaluši",club:"Royale Union Saint-Gilloise",pos:"DEF",minutes:457,price:8.0},
  {id:"usg-vandeperre",name:"Kamiel Van De Perre",club:"Royale Union Saint-Gilloise",pos:"MID",minutes:604,price:9.5},
  {id:"usg-patris",name:"Louis Patris",club:"Royale Union Saint-Gilloise",pos:"MID",minutes:543,price:9.0},
  {id:"usg-smith",name:"Guilherme Smith",club:"Royale Union Saint-Gilloise",pos:"MID",minutes:502,price:9.0},
  {id:"usg-zeneli",name:"Besfort Zeneli",club:"Royale Union Saint-Gilloise",pos:"FWD",minutes:521,price:15.0},

  // Anderlecht
  {id:"and-coosemans",name:"Colin Coosemans",club:"RSC Anderlecht",pos:"GK",minutes:630,price:9.0},
  {id:"and-maamar",name:"Ali Maamar",club:"RSC Anderlecht",pos:"DEF",minutes:630,price:8.5},
  {id:"and-petrot",name:"Léo Pétrot",club:"RSC Anderlecht",pos:"DEF",minutes:630,price:9.0},
  {id:"and-augustinsson",name:"Ludwig Augustinsson",club:"RSC Anderlecht",pos:"DEF",minutes:556,price:10.0},
  {id:"and-biancone",name:"Giulian Biancone",club:"RSC Anderlecht",pos:"DEF",minutes:486,price:8.0},
  {id:"and-kana",name:"Marco Kana",club:"RSC Anderlecht",pos:"MID",minutes:512,price:9.0},
  {id:"and-ambros",name:"Lukáš Ambros",club:"RSC Anderlecht",pos:"MID",minutes:425,price:8.5},
  {id:"and-sikan",name:"Danylo Sikan",club:"RSC Anderlecht",pos:"FWD",minutes:502,price:13.0},

  // Beveren
  {id:"bev-schenk",name:"Johannes Schenk",club:"SK Beveren",pos:"GK",minutes:450,price:5.5},
  {id:"bev-jans",name:"Laurent Jans",club:"SK Beveren",pos:"DEF",minutes:450,price:5.5},
  {id:"bev-janssens",name:"Christophe Janssens",club:"SK Beveren",pos:"DEF",minutes:411,price:5.0},
  {id:"bev-dewaele",name:"Sieben Dewaele",club:"SK Beveren",pos:"MID",minutes:450,price:6.0},
  {id:"bev-lokesa",name:"Chris Lokesa",club:"SK Beveren",pos:"FWD",minutes:413,price:7.0},

  // Charleroi
  {id:"cha-kone",name:"Mohamed Koné",club:"Sporting Charleroi",pos:"GK",minutes:540,price:8.5},
  {id:"cha-delavallee",name:"Martin Delavallée",club:"Sporting Charleroi",pos:"GK",minutes:90,price:4.0},
  {id:"cha-vandekerkhof",name:"Kévin Van Den Kerkhof",club:"Sporting Charleroi",pos:"DEF",minutes:625,price:10.5},
  {id:"cha-nzita",name:"Mardochee Nzita",club:"Sporting Charleroi",pos:"DEF",minutes:605,price:8.5},
  {id:"cha-keita",name:"Check Keita",club:"Sporting Charleroi",pos:"DEF",minutes:540,price:8.0},
  {id:"cha-khalifi",name:"Yassine Khalifi",club:"Sporting Charleroi",pos:"MID",minutes:605,price:8.0},
  {id:"cha-romsaas",name:"Jakob Romsaas",club:"Sporting Charleroi",pos:"MID",minutes:557,price:8.5},
  {id:"cha-boukamir",name:"Amine Boukamir",club:"Sporting Charleroi",pos:"MID",minutes:476,price:7.0},
  {id:"cha-pflucke",name:"Patrick Pflücke",club:"Sporting Charleroi",pos:"MID",minutes:462,price:9.0},

  // Standard
  {id:"sta-epolo",name:"Matthieu Epolo",club:"Standard de Liège",pos:"GK",minutes:630,price:7.5},
  {id:"sta-hautekiet",name:"Ibe Hautekiet",club:"Standard de Liège",pos:"DEF",minutes:630,price:8.0},
  {id:"sta-karamoko",name:"Ibrahim Karamoko",club:"Standard de Liège",pos:"DEF",minutes:630,price:7.5},
  {id:"sta-fossey",name:"Marlon Fossey",club:"Standard de Liège",pos:"DEF",minutes:515,price:8.0},
  {id:"sta-nielsen",name:"Casper Nielsen",club:"Standard de Liège",pos:"MID",minutes:630,price:11.0},
  {id:"sta-trouillet",name:"Alexis Trouillet",club:"Standard de Liège",pos:"MID",minutes:555,price:8.0},
  {id:"sta-touzghar",name:"Rayan Touzghar",club:"Standard de Liège",pos:"MID",minutes:468,price:7.0},
  {id:"sta-abid",name:"Adnane Abid",club:"Standard de Liège",pos:"FWD",minutes:630,price:11.0},

  // STVV
  {id:"stv-kokubo",name:"Leo Kokubo",club:"STVV",pos:"GK",minutes:630,price:8.0},
  {id:"stv-musliu",name:"Visar Musliu",club:"STVV",pos:"DEF",minutes:630,price:8.5},
  {id:"stv-sissako",name:"Abdoulaye Sissako",club:"STVV",pos:"MID",minutes:612,price:8.5},
  {id:"stv-sebaoui",name:"Ilias Sebaoui",club:"STVV",pos:"MID",minutes:621,price:9.5},
  {id:"stv-bazdar",name:"Samed Baždar",club:"STVV",pos:"FWD",minutes:null,price:13.0},

  // Zulte Waregem
  {id:"zul-bostyn",name:"Louis Bostyn",club:"SV Zulte Waregem",pos:"GK",minutes:585,price:6.5},
  {id:"zul-gabriel",name:"Brent Gabriël",club:"SV Zulte Waregem",pos:"GK",minutes:45,price:3.5},
  {id:"zul-kiilerich",name:"Jakob Kiilerich",club:"SV Zulte Waregem",pos:"DEF",minutes:630,price:7.0},
  {id:"zul-lemoine",name:"Laurent Lemoine",club:"SV Zulte Waregem",pos:"DEF",minutes:630,price:7.0},
  {id:"zul-cappelle",name:"Yannick Cappelle",club:"SV Zulte Waregem",pos:"DEF",minutes:611,price:7.0},
  {id:"zul-lofolomo",name:"Enrique Lofolomo",club:"SV Zulte Waregem",pos:"MID",minutes:630,price:8.0},
  {id:"zul-claes",name:"Thomas Claes",club:"SV Zulte Waregem",pos:"MID",minutes:616,price:7.5},
  {id:"zul-ake",name:"Marley Aké",club:"SV Zulte Waregem",pos:"FWD",minutes:580,price:9.0},
  {id:"zul-ementa",name:"Anosike Ementa",club:"SV Zulte Waregem",pos:"FWD",minutes:615,price:14.0}
].map(p => ({
  ...p,
  price: p.id === "clu-vanaken" ? 25 : Math.min(24, Math.round(p.price * 3) / 2),
  score: 0
}));

// Aanvulling op basis van de officiële Pro League-selecties van 5 oktober 2026.
// Bij live gebruik vervangt de datafeed minuten, prijzen en scores automatisch.
const EXTRA_PLAYERS = [
  // Cercle Brugge
  {id:"cer-lienard",name:"Yann Lienard",club:"Cercle Brugge",pos:"GK",minutes:0,price:3},
  {id:"cer-langenbick",name:"Bas Langenbick",club:"Cercle Brugge",pos:"GK",minutes:0,price:1},
  {id:"cer-kakou",name:"Emmanuel Kakou",club:"Cercle Brugge",pos:"DEF",minutes:0,price:5},
  {id:"cer-adaramola",name:"Tayo Adaramola",club:"Cercle Brugge",pos:"DEF",minutes:0,price:4},
  {id:"cer-amani",name:"Lazare Amani",club:"Cercle Brugge",pos:"MID",minutes:0,price:6},
  {id:"cer-manneh",name:"Abdoulie Manneh",club:"Cercle Brugge",pos:"MID",minutes:0,price:4},
  {id:"cer-herrmann",name:"Charles Herrmann",club:"Cercle Brugge",pos:"FWD",minutes:0,price:5},

  // Club Brugge — volledige officiële A-selectie
  {id:"clu-jackers",name:"Nordin Jackers",club:"Club Brugge",pos:"GK",minutes:0,price:7},
  {id:"clu-decorte",name:"Axl De Corte",club:"Club Brugge",pos:"GK",minutes:0,price:2},
  {id:"clu-vandendriessche",name:"Argus Vanden Driessche",club:"Club Brugge",pos:"GK",minutes:0,price:1},
  {id:"clu-ordonez",name:"Joel Ordóñez",club:"Club Brugge",pos:"DEF",minutes:0,price:13},
  {id:"clu-dams",name:"Matteo Dams",club:"Club Brugge",pos:"DEF",minutes:0,price:9},
  {id:"clu-siquet",name:"Hugo Siquet",club:"Club Brugge",pos:"DEF",minutes:0,price:10},
  {id:"clu-coulibaly",name:"Samba Coulibaly",club:"Club Brugge",pos:"DEF",minutes:0,price:5},
  {id:"clu-spileers",name:"Jorne Spileers",club:"Club Brugge",pos:"DEF",minutes:0,price:8},
  {id:"clu-sabbe",name:"Kyriani Sabbe",club:"Club Brugge",pos:"DEF",minutes:0,price:8},
  {id:"clu-gomez",name:"Samuel Gomez van Hoogen",club:"Club Brugge",pos:"DEF",minutes:0,price:3},
  {id:"clu-garcia",name:"Andre Garcia",club:"Club Brugge",pos:"DEF",minutes:0,price:4},
  {id:"clu-verlinden",name:"Wout Verlinden",club:"Club Brugge",pos:"DEF",minutes:0,price:1},
  {id:"clu-tsawa",name:"Cheveyo Tsawa",club:"Club Brugge",pos:"MID",minutes:0,price:4},
  {id:"clu-audoor",name:"Lynnt Audoor",club:"Club Brugge",pos:"MID",minutes:0,price:3},
  {id:"clu-lemarechal",name:"Félix Lemaréchal",club:"Club Brugge",pos:"MID",minutes:0,price:9},
  {id:"clu-naikoren",name:"Tian Nai Koren",club:"Club Brugge",pos:"MID",minutes:0,price:2},
  {id:"clu-okon",name:"Gianluca Okon-Engstler",club:"Club Brugge",pos:"MID",minutes:0,price:1},
  {id:"clu-forbs",name:"Carlos Forbs",club:"Club Brugge",pos:"FWD",minutes:0,price:15},
  {id:"clu-virgili",name:"Jan Virgili",club:"Club Brugge",pos:"FWD",minutes:0,price:11},
  {id:"clu-vermant",name:"Romeo Vermant",club:"Club Brugge",pos:"FWD",minutes:0,price:14},
  {id:"clu-mike",name:"Wisdom Mike",club:"Club Brugge",pos:"FWD",minutes:0,price:6},
  {id:"clu-robberechts",name:"Milan Robberechts",club:"Club Brugge",pos:"FWD",minutes:0,price:3},
  {id:"clu-diakhon",name:"Mamadou Diakhon",club:"Club Brugge",pos:"FWD",minutes:0,price:5},
  {id:"clu-vasovic",name:"Andrej Vasovic",club:"Club Brugge",pos:"FWD",minutes:0,price:1},

  // KAA Gent
  {id:"gen-peersman",name:"Kjell Peersman",club:"KAA Gent",pos:"GK",minutes:0,price:5},
  {id:"gen-evers",name:"Bas Evers",club:"KAA Gent",pos:"GK",minutes:0,price:1},
  {id:"gen-paskotsi",name:"Maksim Paskotsi",club:"KAA Gent",pos:"DEF",minutes:0,price:6},
  {id:"gen-ayinde",name:"Abdoul Ayindé",club:"KAA Gent",pos:"DEF",minutes:0,price:4},
  {id:"gen-benes",name:"László Bénes",club:"KAA Gent",pos:"MID",minutes:0,price:9},
  {id:"gen-delorge",name:"Mathias Delorge",club:"KAA Gent",pos:"MID",minutes:0,price:8},
  {id:"gen-dean",name:"Max Dean",club:"KAA Gent",pos:"FWD",minutes:0,price:10},

  // KRC Genk
  {id:"krg-leysen",name:"Tobe Leysen",club:"KRC Genk",pos:"GK",minutes:0,price:8},
  {id:"krg-lawal",name:"Tobias Lawal",club:"KRC Genk",pos:"GK",minutes:0,price:5},
  {id:"krg-doucoure",name:"Émile Doucouré",club:"KRC Genk",pos:"GK",minutes:0,price:1},
  {id:"krg-smets",name:"Matte Smets",club:"KRC Genk",pos:"DEF",minutes:0,price:12},
  {id:"krg-ravych",name:"Christiaan Ravych",club:"KRC Genk",pos:"DEF",minutes:0,price:8},
  {id:"krg-medina",name:"Yaimar Medina",club:"KRC Genk",pos:"DEF",minutes:0,price:7},
  {id:"krg-tahirovic",name:"Benjamin Tahirovic",club:"KRC Genk",pos:"MID",minutes:0,price:10},
  {id:"krg-heymans",name:"Daan Heymans",club:"KRC Genk",pos:"MID",minutes:0,price:12},
  {id:"krg-ito",name:"Junya Ito",club:"KRC Genk",pos:"FWD",minutes:0,price:15},
  {id:"krg-bibout",name:"Aaron Bibout",club:"KRC Genk",pos:"FWD",minutes:0,price:7},

  // KV Kortrijk
  {id:"kor-gunnarsson",name:"Patrik Gunnarsson",club:"KV Kortrijk",pos:"GK",minutes:0,price:6},
  {id:"kor-devlaeminck",name:"Ebbe De Vlaeminck",club:"KV Kortrijk",pos:"GK",minutes:0,price:1},
  {id:"kor-anderson",name:"Matthew Anderson",club:"KV Kortrijk",pos:"DEF",minutes:0,price:6},
  {id:"kor-murraycampbell",name:"Harrison Murray-Campbell",club:"KV Kortrijk",pos:"DEF",minutes:0,price:4},
  {id:"kor-dewaele",name:"Gilles Dewaele",club:"KV Kortrijk",pos:"DEF",minutes:0,price:5},
  {id:"kor-hens",name:"Lennard Hens",club:"KV Kortrijk",pos:"MID",minutes:0,price:7},
  {id:"kor-desmet",name:"Liam De Smet",club:"KV Kortrijk",pos:"MID",minutes:0,price:5},
  {id:"kor-lambert",name:"Boris Lambert",club:"KV Kortrijk",pos:"MID",minutes:0,price:4},
  {id:"kor-koyalipou",name:"Goduine Koyalipou",club:"KV Kortrijk",pos:"FWD",minutes:0,price:8},
  {id:"kor-ambrose",name:"Thierry Ambrose",club:"KV Kortrijk",pos:"FWD",minutes:0,price:7},

  // KV Mechelen
  {id:"mec-dewolf",name:"Ortwin De Wolf",club:"KV Mechelen",pos:"GK",minutes:0,price:6},
  {id:"mec-vaningelgom",name:"Tijn Van Ingelgom",club:"KV Mechelen",pos:"GK",minutes:0,price:1},
  {id:"mec-diouf",name:"Gora Diouf",club:"KV Mechelen",pos:"DEF",minutes:0,price:7},
  {id:"mec-eerdhuijzen",name:"Mike Eerdhuijzen",club:"KV Mechelen",pos:"DEF",minutes:0,price:6},
  {id:"mec-teague",name:"Ryan Teague",club:"KV Mechelen",pos:"MID",minutes:0,price:8},
  {id:"mec-salifou",name:"Dikeni Salifou",club:"KV Mechelen",pos:"MID",minutes:0,price:5},
  {id:"mec-raman",name:"Benito Raman",club:"KV Mechelen",pos:"FWD",minutes:0,price:10},

  // KVC Westerlo
  {id:"wes-lathouwers",name:"Bill Lathouwers",club:"KVC Westerlo",pos:"GK",minutes:0,price:4},
  {id:"wes-wiegel",name:"Jahnilo Wiegel-Triebel",club:"KVC Westerlo",pos:"GK",minutes:0,price:1},
  {id:"wes-flo",name:"Lasse Flø",club:"KVC Westerlo",pos:"DEF",minutes:0,price:5},
  {id:"wes-balogh",name:"Botond Balogh",club:"KVC Westerlo",pos:"DEF",minutes:0,price:7},
  {id:"wes-sydorchuk",name:"Serhii Sydorchuk",club:"KVC Westerlo",pos:"MID",minutes:0,price:7},
  {id:"wes-haspolat",name:"Dogucan Haspolat",club:"KVC Westerlo",pos:"MID",minutes:0,price:9},
  {id:"wes-storm",name:"Nikola Storm",club:"KVC Westerlo",pos:"FWD",minutes:0,price:8},

  // Lommel SK
  {id:"lom-ivezic",name:"Nikola Ivezic",club:"Lommel SK",pos:"GK",minutes:0,price:4},
  {id:"lom-vercauteren",name:"Rik Vercauteren",club:"Lommel SK",pos:"GK",minutes:0,price:1},
  {id:"lom-adewoye",name:"Shawn Adewoye",club:"Lommel SK",pos:"DEF",minutes:0,price:5},
  {id:"lom-tolinsson",name:"Jesper Tolinsson",club:"Lommel SK",pos:"DEF",minutes:0,price:4},
  {id:"lom-rommens",name:"Nicolas Rommens",club:"Lommel SK",pos:"MID",minutes:0,price:6},
  {id:"lom-nypan",name:"Sverre Nypan",club:"Lommel SK",pos:"MID",minutes:0,price:7},
  {id:"lom-talvitie",name:"Juho Talvitie",club:"Lommel SK",pos:"FWD",minutes:0,price:6},
  {id:"lom-seuntjens",name:"Ralf Seuntjens",club:"Lommel SK",pos:"FWD",minutes:0,price:5},

  // OH Leuven
  {id:"ohl-vroman",name:"Kiany Vroman",club:"OH Leuven",pos:"GK",minutes:0,price:3},
  {id:"ohl-jochmans",name:"Owen Jochmans",club:"OH Leuven",pos:"GK",minutes:0,price:1},
  {id:"ohl-lawrence",name:"Jamie Lawrence",club:"OH Leuven",pos:"DEF",minutes:0,price:6},
  {id:"ohl-ogiwara",name:"Takuya Ogiwara",club:"OH Leuven",pos:"DEF",minutes:0,price:7},
  {id:"ohl-verstraete",name:"Birger Verstraete",club:"OH Leuven",pos:"MID",minutes:0,price:9},
  {id:"ohl-teklab",name:"Henok Teklab",club:"OH Leuven",pos:"MID",minutes:0,price:6},
  {id:"ohl-addai",name:"Emmanuel Addai",club:"OH Leuven",pos:"FWD",minutes:0,price:8},
  {id:"ohl-vaesen",name:"Kyan Vaesen",club:"OH Leuven",pos:"FWD",minutes:0,price:10},
  {id:"ohl-yamada",name:"Shin Yamada",club:"OH Leuven",pos:"FWD",minutes:0,price:5},

  // RAAL La Louvière
  {id:"raal-cardoso",name:"Tiago Pereira Cardoso",club:"RAAL La Louvière",pos:"GK",minutes:0,price:5},
  {id:"raal-monteiro",name:"Lucas Monteiro",club:"RAAL La Louvière",pos:"GK",minutes:0,price:1},
  {id:"raal-gillot",name:"Nolan Gillot",club:"RAAL La Louvière",pos:"DEF",minutes:0,price:5},
  {id:"raal-lutonda",name:"Thierry Lutonda",club:"RAAL La Louvière",pos:"DEF",minutes:0,price:6},
  {id:"raal-kovacs",name:"Mátyás Kovács",club:"RAAL La Louvière",pos:"MID",minutes:0,price:5},
  {id:"raal-soumare",name:"Bryan Soumaré",club:"RAAL La Louvière",pos:"MID",minutes:0,price:7},
  {id:"raal-filet",name:"Elias Filet",club:"RAAL La Louvière",pos:"FWD",minutes:0,price:6},
  {id:"raal-belkheir",name:"Mouhamed Belkheir",club:"RAAL La Louvière",pos:"FWD",minutes:0,price:8},

  // Royal Antwerp FC
  {id:"ant-thoelen",name:"Yannick Thoelen",club:"Royal Antwerp FC",pos:"GK",minutes:0,price:5},
  {id:"ant-devalckeneer",name:"Niels Devalckeneer",club:"Royal Antwerp FC",pos:"GK",minutes:0,price:1},
  {id:"ant-foulon",name:"Daam Foulon",club:"Royal Antwerp FC",pos:"DEF",minutes:0,price:8},
  {id:"ant-busi",name:"Maxime Busi",club:"Royal Antwerp FC",pos:"DEF",minutes:0,price:7},
  {id:"ant-benitez",name:"Mauricio Benítez",club:"Royal Antwerp FC",pos:"MID",minutes:0,price:7},
  {id:"ant-vermeeren",name:"Arthur Vermeeren",club:"Royal Antwerp FC",pos:"MID",minutes:0,price:12},
  {id:"ant-salah",name:"Ibrahim Salah",club:"Royal Antwerp FC",pos:"FWD",minutes:0,price:10},

  // Royale Union Saint-Gilloise
  {id:"usg-boets",name:"Keo Boets",club:"Royale Union Saint-Gilloise",pos:"GK",minutes:0,price:1},
  {id:"usg-chambaere",name:"Vic Chambaere",club:"Royale Union Saint-Gilloise",pos:"GK",minutes:0,price:3},
  {id:"usg-chibani",name:"Nohim Chibani",club:"Royale Union Saint-Gilloise",pos:"DEF",minutes:0,price:4},
  {id:"usg-sykes",name:"Ross Sykes",club:"Royale Union Saint-Gilloise",pos:"DEF",minutes:0,price:8},
  {id:"usg-zorgane",name:"Adem Zorgane",club:"Royale Union Saint-Gilloise",pos:"MID",minutes:0,price:11},
  {id:"usg-schoofs",name:"Rob Schoofs",club:"Royale Union Saint-Gilloise",pos:"MID",minutes:0,price:10},
  {id:"usg-rodriguez",name:"Kevin Rodríguez",club:"Royale Union Saint-Gilloise",pos:"FWD",minutes:0,price:12},

  // RSC Anderlecht
  {id:"and-heekeren",name:"Justin Heekeren",club:"RSC Anderlecht",pos:"GK",minutes:0,price:5},
  {id:"and-seghers",name:"Mattis Seghers",club:"RSC Anderlecht",pos:"GK",minutes:0,price:1},
  {id:"and-hey",name:"Lucas Hey",club:"RSC Anderlecht",pos:"DEF",minutes:0,price:8},
  {id:"and-sardella",name:"Killian Sardella",club:"RSC Anderlecht",pos:"DEF",minutes:0,price:10},
  {id:"and-stroeykens",name:"Mario Stroeykens",club:"RSC Anderlecht",pos:"MID",minutes:0,price:13},
  {id:"and-aasgaard",name:"Thelo Aasgaard",club:"RSC Anderlecht",pos:"MID",minutes:0,price:10},
  {id:"and-bertaccini",name:"Adriano Bertaccini",club:"RSC Anderlecht",pos:"FWD",minutes:0,price:14},

  // SK Beveren
  {id:"bev-deschutter",name:"Milan De Schutter",club:"SK Beveren",pos:"GK",minutes:0,price:3},
  {id:"bev-deman",name:"Maxim Deman",club:"SK Beveren",pos:"GK",minutes:0,price:1},
  {id:"bev-thompson",name:"Dominic Thompson",club:"SK Beveren",pos:"DEF",minutes:0,price:5},
  {id:"bev-boone",name:"Viktor Boone",club:"SK Beveren",pos:"DEF",minutes:0,price:6},
  {id:"bev-godeau",name:"Bruno Godeau",club:"SK Beveren",pos:"DEF",minutes:0,price:6},
  {id:"bev-rigo",name:"Dante Rigo",club:"SK Beveren",pos:"MID",minutes:0,price:7},
  {id:"bev-bruls",name:"Christian Brüls",club:"SK Beveren",pos:"MID",minutes:0,price:6},
  {id:"bev-verschueren",name:"Arno Verschueren",club:"SK Beveren",pos:"MID",minutes:0,price:7},
  {id:"bev-olatunji",name:"Victor Olatunji",club:"SK Beveren",pos:"FWD",minutes:0,price:9},
  {id:"bev-mertens",name:"Lennart Mertens",club:"SK Beveren",pos:"FWD",minutes:0,price:5},

  // Sporting Charleroi
  {id:"cha-cremer",name:"Arthur Cremer",club:"Sporting Charleroi",pos:"GK",minutes:0,price:1},
  {id:"cha-ousou",name:"Aiham Ousou",club:"Sporting Charleroi",pos:"DEF",minutes:0,price:7},
  {id:"cha-rowe",name:"Triston Rowe",club:"Sporting Charleroi",pos:"DEF",minutes:0,price:5},
  {id:"cha-nawata",name:"Gaku Nawata",club:"Sporting Charleroi",pos:"MID",minutes:0,price:7},
  {id:"cha-bojang",name:"Adama Bojang",club:"Sporting Charleroi",pos:"FWD",minutes:0,price:8},
  {id:"cha-scheidler",name:"Aurélien Scheidler",club:"Sporting Charleroi",pos:"FWD",minutes:0,price:10},

  // Standard de Liège
  {id:"sta-pirard",name:"Lucas Pirard",club:"Standard de Liège",pos:"GK",minutes:0,price:4},
  {id:"sta-dizdarevic",name:"Belmin Dizdarevic",club:"Standard de Liège",pos:"GK",minutes:0,price:1},
  {id:"sta-lavalee",name:"Dimitri Lavalée",club:"Standard de Liège",pos:"DEF",minutes:0,price:8},
  {id:"sta-lawrence",name:"Henry Lawrence",club:"Standard de Liège",pos:"DEF",minutes:0,price:6},
  {id:"sta-mohr",name:"Tobias Mohr",club:"Standard de Liège",pos:"MID",minutes:0,price:8},
  {id:"sta-ilaimaharitra",name:"Marco Ilaimaharitra",club:"Standard de Liège",pos:"MID",minutes:0,price:9},
  {id:"sta-zeqiri",name:"Andi Zeqiri",club:"Standard de Liège",pos:"FWD",minutes:0,price:12},

  // STVV
  {id:"stv-lendfers",name:"Matt Lendfers",club:"STVV",pos:"GK",minutes:0,price:3},
  {id:"stv-aburasyin",name:"Ahmad Aburasyin",club:"STVV",pos:"GK",minutes:0,price:1},
  {id:"stv-hata",name:"Taiga Hata",club:"STVV",pos:"DEF",minutes:0,price:7},
  {id:"stv-takai",name:"Kota Takai",club:"STVV",pos:"DEF",minutes:0,price:8},
  {id:"stv-taniguchi",name:"Shogo Taniguchi",club:"STVV",pos:"DEF",minutes:0,price:7},
  {id:"stv-merlen",name:"Ryan Merlen",club:"STVV",pos:"MID",minutes:0,price:6},
  {id:"stv-araki",name:"Ryotaro Araki",club:"STVV",pos:"MID",minutes:0,price:9},
  {id:"stv-muja",name:"Arbnor Muja",club:"STVV",pos:"FWD",minutes:0,price:9},
  {id:"stv-mbuku",name:"Nathanaël Mbuku",club:"STVV",pos:"FWD",minutes:0,price:10},
  {id:"stv-seolle",name:"Frederic Soèllé Soèllé",club:"STVV",pos:"FWD",minutes:0,price:4},

  // SV Zulte Waregem
  {id:"zul-vanbever",name:"Florian Van Bever",club:"SV Zulte Waregem",pos:"GK",minutes:0,price:1},
  {id:"zul-paugain",name:"Wilguens Paugain",club:"SV Zulte Waregem",pos:"DEF",minutes:0,price:6},
  {id:"zul-barkarson",name:"Atli Barkarson",club:"SV Zulte Waregem",pos:"DEF",minutes:0,price:5},
  {id:"zul-horvat",name:"Niko Horvat",club:"SV Zulte Waregem",pos:"MID",minutes:0,price:7},
  {id:"zul-niang",name:"Ousseynou Niang",club:"SV Zulte Waregem",pos:"MID",minutes:0,price:6},
  {id:"zul-mbaye",name:"Malick Mbaye",club:"SV Zulte Waregem",pos:"FWD",minutes:0,price:7}
].map(player => ({...player,score:0}));

PLAYERS.push(...EXTRA_PLAYERS);

const MATCHES = [
  {date:"18 sep 2026",week:"Speeldag 7",home:"KAA Gent",away:"Standard de Liège",homeScore:2,awayScore:1},
  {date:"19 sep 2026",week:"Speeldag 7",home:"OH Leuven",away:"RAAL La Louvière",homeScore:2,awayScore:0},
  {date:"19 sep 2026",week:"Speeldag 7",home:"Sporting Charleroi",away:"Cercle Brugge",homeScore:3,awayScore:2},
  {date:"19 sep 2026",week:"Speeldag 7",home:"Lommel SK",away:"KV Mechelen",homeScore:0,awayScore:0},
  {date:"19 sep 2026",week:"Speeldag 7",home:"RSC Anderlecht",away:"SV Zulte Waregem",homeScore:3,awayScore:0},
  {date:"20 sep 2026",week:"Speeldag 7",home:"Royal Antwerp FC",away:"Royale Union Saint-Gilloise",homeScore:0,awayScore:2},
  {date:"20 sep 2026",week:"Speeldag 7",home:"STVV",away:"KVC Westerlo",homeScore:0,awayScore:2},
  {date:"20 sep 2026",week:"Speeldag 7",home:"Club Brugge",away:"KRC Genk",homeScore:3,awayScore:0},
  {date:"20 sep 2026",week:"Speeldag 7",home:"KV Kortrijk",away:"SK Beveren",homeScore:1,awayScore:0}
];

const SCORING = {
  columns: [
    ["minutes","Speelminuut"],["save","Save"],["cleanSheet","Clean sheet"],["savesInsideBox","Saves inside box"],["punches","Punches"],
    ["goalsConceded","Goals conceded"],["foulsMade","Fouls made"],["foulsDrawn","Fouls get"],
    ["yellow","Yellow card"],["red","Red card"],["goal","Goal"],["assist","Assist"],
    ["successfulTackles","Successful tackles"],["duelWon","Duel won"],["duelLost","Duel lost"],
    ["clearances","Clearances"],["interceptions","Interceptions"],["possessionWon","Possession won"],
    ["possessionLost","Possession lost"],["successfulPass","Successful pass"],
    ["successfulLongPass","Successful Long Passes"],["keyPass","Key passes"],["passMissed","Pass missed"],
    ["successfulDribble","Successful dribble"],["shotOnTarget","Shots on target"]
  ],
  rows: {
    GK: {minutes:.1,save:3,cleanSheet:20,savesInsideBox:5,punches:2,goalsConceded:-5,foulsMade:-1,foulsDrawn:1,yellow:-3,red:-10,goal:10,assist:10,successfulTackles:3,duelWon:.5,duelLost:-.5,clearances:2,interceptions:1,possessionWon:.2,possessionLost:-.2,successfulPass:.1,successfulLongPass:.3,keyPass:.4,passMissed:-.2,successfulDribble:.2,shotOnTarget:2},
    DEF:{minutes:.1,save:null,cleanSheet:null,savesInsideBox:null,punches:null,goalsConceded:-5,foulsMade:-1,foulsDrawn:1,yellow:-3,red:-10,goal:10,assist:10,successfulTackles:4,duelWon:1,duelLost:-1,clearances:2,interceptions:2,possessionWon:.2,possessionLost:-.2,successfulPass:.1,successfulLongPass:.3,keyPass:.4,passMissed:-.2,successfulDribble:.2,shotOnTarget:2},
    MID:{minutes:.1,save:null,cleanSheet:null,savesInsideBox:null,punches:null,goalsConceded:-3,foulsMade:-1,foulsDrawn:1,yellow:-3,red:-10,goal:10,assist:10,successfulTackles:3,duelWon:.5,duelLost:-.5,clearances:1,interceptions:2,possessionWon:.3,possessionLost:-.3,successfulPass:.2,successfulLongPass:.4,keyPass:.6,passMissed:-.3,successfulDribble:.3,shotOnTarget:2},
    FWD:{minutes:.1,save:null,cleanSheet:null,savesInsideBox:null,punches:null,goalsConceded:-1,foulsMade:-1,foulsDrawn:1,yellow:-3,red:-10,goal:10,assist:10,successfulTackles:2,duelWon:1,duelLost:-1,clearances:1,interceptions:1,possessionWon:.2,possessionLost:-.2,successfulPass:.1,successfulLongPass:.3,keyPass:.6,passMissed:-.1,successfulDribble:.5,shotOnTarget:4}
  }
};

const POSITION_LABELS = {GK:"Keeper",DEF:"Verdediger",MID:"Middenvelder",FWD:"Aanvaller"};
