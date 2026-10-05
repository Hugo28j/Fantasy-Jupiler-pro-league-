const DATA_META = {
  season: "2026/27",
  generatedAt: "2026-10-05",
  playerCoverage: "verified-active-seed",
  priceNote: "Voorlopige fantasy-prijzen, geen officiële marktwaarden"
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
].map(p => ({...p, score:0}));

const MATCHES = [
  {date:"7 aug 2026",week:"Speeldag 1",home:"Club Brugge",away:"KV Kortrijk",homeScore:3,awayScore:0},
  {date:"8 aug 2026",week:"Speeldag 1",home:"Standard de Liège",away:"Cercle Brugge",homeScore:2,awayScore:2},
  {date:"15 aug 2026",week:"Speeldag 2",home:"KV Kortrijk",away:"Royal Antwerp FC",homeScore:0,awayScore:3},
  {date:"20 sep 2026",week:"Speeldag 7",home:"KV Kortrijk",away:"SK Beveren",homeScore:1,awayScore:0},
  {date:"Recent",week:"Speeldag 7",home:"Royal Antwerp FC",away:"Royale Union Saint-Gilloise",homeScore:0,awayScore:2},
  {date:"Recent",week:"Speeldag 7",home:"STVV",away:"KVC Westerlo",homeScore:0,awayScore:2},
  {date:"Recent",week:"Speeldag 7",home:"Sporting Charleroi",away:"Cercle Brugge",homeScore:3,awayScore:2}
];

const SCORING = {
  columns: [
    ["save","Save"],["cleanSheet","Clean sheet"],["savesInsideBox","Saves inside box"],["punches","Punches"],
    ["goalsConceded","Goals conceded"],["foulsMade","Fouls made"],["foulsDrawn","Fouls get"],
    ["yellow","Yellow card"],["red","Red card"],["goal","Goal"],["assist","Assist"],
    ["successfulTackles","Successful tackles"],["duelWon","Duel won"],["duelLost","Duel lost"],
    ["clearances","Clearances"],["interceptions","Interceptions"],["possessionWon","Possession won"],
    ["possessionLost","Possession lost"],["successfulPass","Successful pass"],
    ["successfulLongPass","Successful Long Passes"],["keyPass","Key passes"],["passMissed","Pass missed"],
    ["successfulDribble","Successful dribble"],["shotOnTarget","Shots on target"]
  ],
  rows: {
    GK: {save:3,cleanSheet:20,savesInsideBox:5,punches:2,goalsConceded:-5,foulsMade:-1,foulsDrawn:1,yellow:-3,red:-10,goal:10,assist:10,successfulTackles:3,duelWon:.5,duelLost:-.5,clearances:2,interceptions:1,possessionWon:.2,possessionLost:-.2,successfulPass:.1,successfulLongPass:.3,keyPass:.4,passMissed:-.2,successfulDribble:.2,shotOnTarget:2},
    DEF:{save:null,cleanSheet:null,savesInsideBox:null,punches:null,goalsConceded:-5,foulsMade:-1,foulsDrawn:1,yellow:-3,red:-10,goal:10,assist:10,successfulTackles:4,duelWon:1,duelLost:-1,clearances:2,interceptions:2,possessionWon:.2,possessionLost:-.2,successfulPass:.1,successfulLongPass:.3,keyPass:.4,passMissed:-.2,successfulDribble:.2,shotOnTarget:2},
    MID:{save:null,cleanSheet:null,savesInsideBox:null,punches:null,goalsConceded:-3,foulsMade:-1,foulsDrawn:1,yellow:-3,red:-10,goal:10,assist:10,successfulTackles:3,duelWon:.5,duelLost:-.5,clearances:1,interceptions:2,possessionWon:.3,possessionLost:-.3,successfulPass:.2,successfulLongPass:.4,keyPass:.6,passMissed:-.3,successfulDribble:.3,shotOnTarget:2},
    FWD:{save:null,cleanSheet:null,savesInsideBox:null,punches:null,goalsConceded:-1,foulsMade:-1,foulsDrawn:1,yellow:-3,red:-10,goal:10,assist:10,successfulTackles:2,duelWon:1,duelLost:-1,clearances:1,interceptions:1,possessionWon:.2,possessionLost:-.2,successfulPass:.1,successfulLongPass:.3,keyPass:.6,passMissed:-.1,successfulDribble:.5,shotOnTarget:4}
  }
};

const POSITION_LABELS = {GK:"Keeper",DEF:"Verdediger",MID:"Middenvelder",FWD:"Aanvaller"};
