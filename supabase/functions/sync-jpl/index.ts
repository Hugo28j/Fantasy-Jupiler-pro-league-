import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SORARE_GRAPHQL = "https://api.sorare.com/graphql";
const COMPETITION_SLUG = "jupiler-pro-league";
const SEASON_START = 2026;
const SEASON_FROM = new Date("2026-07-01T00:00:00Z").getTime();
const SEASON_TO = new Date("2027-07-01T00:00:00Z").getTime();
const GAME_PAGE_SIZE = 50;
const PLAYER_BATCH_SIZE = 8;
const PLAYER_STATS_LAST = 30;
const STAT_SCHEMA_VERSION = 3;
const SCORING_VERSION = 5;
const PRICE_MODEL_VERSION = 1;

const weights: Record<string,Record<string,number>> = {
  GK:{minutes:.1,save:2,cleanSheet:10,savesInsideBox:4,punches:2,goalsConceded:-7,foulsMade:-1,foulsDrawn:1,yellow:-3,red:-10,goal:10,assist:10,successfulTackles:3,duelWon:.5,duelLost:-.5,clearances:1,interceptions:.5,possessionWon:.2,possessionLost:-.2,successfulPass:.1,successfulLongPass:.3,keyPass:.4,passMissed:-.2,successfulDribble:.2,shotOnTarget:2,bigChanceCreated:2,successfulFinalThirdPasses:.2,bigChanceMissed:-2,penaltyWon:5,totalScoringAtt:.1,penAreaEntries:.3,errorLeadToGoal:-15},
  DEF:{minutes:.1,cleanSheet:5,goalsConceded:-5,foulsMade:-1,foulsDrawn:1,yellow:-3,red:-10,goal:10,assist:10,successfulTackles:4,duelWon:1,duelLost:-1,clearances:1,interceptions:.5,possessionWon:.2,possessionLost:-.3,successfulPass:.1,successfulLongPass:.3,keyPass:.4,passMissed:-.2,successfulDribble:.4,shotOnTarget:2,bigChanceCreated:2,successfulFinalThirdPasses:.2,bigChanceMissed:-2,penaltyWon:5,totalScoringAtt:.2,penAreaEntries:.3,errorLeadToGoal:-15},
  MID:{minutes:.1,goalsConceded:-3,foulsMade:-1,foulsDrawn:1,yellow:-3,red:-10,goal:10,assist:10,successfulTackles:3,duelWon:.5,duelLost:-.5,clearances:.5,interceptions:.5,possessionWon:.4,possessionLost:-.3,successfulPass:.2,successfulLongPass:.5,keyPass:.6,passMissed:-.3,successfulDribble:.6,shotOnTarget:2,bigChanceCreated:3,successfulFinalThirdPasses:.3,bigChanceMissed:-2,penaltyWon:5,totalScoringAtt:.4,penAreaEntries:.3,errorLeadToGoal:-15},
  FWD:{minutes:.1,goalsConceded:-1,foulsMade:-1,foulsDrawn:1,yellow:-3,red:-10,goal:10,assist:10,successfulTackles:2,duelWon:1,duelLost:-.7,clearances:.5,interceptions:.5,possessionWon:.2,possessionLost:-.1,successfulPass:.1,successfulLongPass:.3,keyPass:.6,passMissed:-.1,successfulDribble:.8,shotOnTarget:4,bigChanceCreated:3,successfulFinalThirdPasses:.3,bigChanceMissed:-2,penaltyWon:5,totalScoringAtt:.4,penAreaEntries:.5,errorLeadToGoal:-15}
};

function env(name:string, fallback?:string){
  const value = Deno.env.get(name) || fallback;
  if(!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function num(value:unknown){
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeName(value:string){
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu,"")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .trim();
}

function positionCode(value:string){
  const p = String(value || "").toLowerCase();
  if(p.includes("goal")) return "GK";
  if(p.includes("def") || p.includes("back")) return "DEF";
  if(p.includes("mid")) return "MID";
  if(p.includes("forward") || p.includes("striker") || p.includes("wing")) return "FWD";
  return null;
}

function startingPrice(position:string, name:string, appearances=0, stars=0){
  if(normalizeName(name) === "hans vanaken") return 25;
  const apps = Math.max(0,num(appearances));
  if(apps === 0) return 1;
  if(apps <= 2) return 2;
  if(apps <= 5) return 4;
  const base:Record<string,number> = {GK:6,DEF:7,MID:8,FWD:9};
  const availability = Math.min(5,apps/2.5);
  const quality = Math.min(10,Math.max(0,num(stars))*2);
  return Math.min(24,Math.max(5,Math.round((base[position]+availability+quality)*2)/2));
}

function fantasyScore(position:string, stats:Record<string,number>){
  return Math.round(Object.entries(weights[position] || {})
    .reduce((total,[key,weight]) => total + num(stats[key])*weight,0)*100)/100;
}

function roundPrice(value:number){
  return Math.round(value*10)/10;
}

function marketPriceDelta(price:number, points:number){
  if(points <= 0) return -2;
  const ratio = price > 0 ? (points/price)*100 : 0;
  if(ratio < 30) return -2;
  if(ratio < 40) return -1;
  if(ratio < 70) return -0.7;
  if(ratio < 90) return -0.5;
  if(ratio < 100) return -0.3;
  if(ratio < 110) return 0.3;
  if(ratio < 120) return 0.5;
  if(ratio < 140) return 1;
  if(ratio < 160) return 1.5;
  return 2;
}

function mapSorareStats(raw:any){
  return {
    minutes:num(raw.minsPlayed),
    save:num(raw.saves),
    cleanSheet:num(raw.cleanSheet),
    savesInsideBox:num(raw.savedIbox),
    punches:num(raw.punches),
    goalsConceded:num(raw.goalsConceded),
    foulsMade:num(raw.fouls),
    foulsDrawn:num(raw.wasFouled),
    yellow:num(raw.yellowCard),
    red:num(raw.redCard),
    goal:num(raw.goals),
    assist:num(raw.goalAssist),
    successfulTackles:num(raw.wonTackle),
    duelWon:num(raw.duelWon),
    duelLost:num(raw.duelLost),
    clearances:num(raw.totalClearance),
    interceptions:num(raw.interceptionWon),
    possessionWon:num(raw.possWon),
    possessionLost:num(raw.possLostCtrl),
    successfulPass:num(raw.accuratePass),
    successfulLongPass:num(raw.accurateLongBalls),
    // Sorare PlayerGameStats heeft momenteel geen rechtstreeks key-pass veld.
    keyPass:0,
    passMissed:num(raw.missedPass),
    successfulDribble:num(raw.wonContest),
    shotOnTarget:num(raw.ontargetScoringAtt),
    bigChanceCreated:num(raw.bigChanceCreated),
    successfulFinalThirdPasses:num(raw.successfulFinalThirdPasses),
    bigChanceMissed:num(raw.bigChanceMissed),
    penaltyWon:num(raw.penaltyWon),
    totalScoringAtt:num(raw.totalScoringAtt),
    penAreaEntries:num(raw.penAreaEntries),
    errorLeadToGoal:num(raw.errorLeadToGoal)
  };
}

// De databasekolommen zijn bigint, maar PostgREST/JavaScript moet deze IDs exact kunnen
// teruglezen. Daarom houden we Sorare-hashes bewust binnen Number.MAX_SAFE_INTEGER.
function stableBigint(value:string){
  const bytes = new TextEncoder().encode(value);
  let hash = 1469598103934665603n;
  const prime = 1099511628211n;
  for(const byte of bytes){
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64,hash*prime);
  }
  hash &= 0x1fffffffffffffn; // 53 bits: veilig exact in JavaScript
  if(hash === 0n) hash = 1n;
  return hash.toString();
}

function playerDbId(slug:string){
  return `sorare-${slug}`;
}

function fixtureDbId(providerId:string){
  return stableBigint(`sorare-game:${providerId}`);
}

function statusCode(value:string){
  const s = String(value || "").toLowerCase();
  if(s === "played") return "FT";
  if(s === "playing" || s === "live") return "LIVE";
  if(s === "cancelled" || s === "canceled") return "CANC";
  if(s === "postponed") return "PST";
  return "NS";
}

function chunks<T>(items:T[],size:number){
  const result:T[][] = [];
  for(let i=0;i<items.length;i+=size) result.push(items.slice(i,i+size));
  return result;
}

const ROUND_BY_GAME_ID: Record<string,number> = {
  "Game:0a40e146-42d7-4265-afef-a5bf1fbfead0":1,
  "Game:30392659-3511-49c2-9aef-66bbe5635b5e":1,
  "Game:59be823e-d3d2-45fd-8eb7-9b475f6e43a5":1,
  "Game:63657a4c-ae8d-40a7-b19b-59ae854d4221":1,
  "Game:941e55a8-25ec-481d-8c51-4f6d505b1957":1,
  "Game:96ce1b4e-e52f-4ffd-9bc7-e4cf8712f260":1,
  "Game:b3c80b4e-0dc1-4f31-8d54-0dceca1cb6cd":1,
  "Game:df8c1e01-ec26-47af-b694-51698b14a797":1,
  "Game:ecbc6053-2638-4dfa-8bab-dd40c5d0ee48":1,
  "Game:17379352-7b42-4706-9d33-ff0980bcaebc":2,
  "Game:44729872-4e36-4f39-aa88-0e727d81413f":2,
  "Game:73eee837-c005-49d4-aee4-88633dffef1f":2,
  "Game:7d62764d-f5e8-475b-a012-48be5d757b3d":2,
  "Game:99741ccf-b366-47ae-adb2-d6b47a2e391b":2,
  "Game:c942260c-15f3-483a-b612-d7fa886f0e76":2,
  "Game:cc4ffa20-50ef-4e89-be81-45aee862e960":2,
  "Game:d46d2aaf-6f58-454b-9f6c-9c67f4a02498":2,
  "Game:f444dd13-59ef-4e21-ac54-c8512dbd16c0":2,
  "Game:2b60765f-f282-4d95-bd9d-00cb164e0565":3,
  "Game:58bf9114-2472-4fa1-a179-572f615bddea":3,
  "Game:5a435705-feb4-4ef6-a2c2-9bbb29b813a4":3,
  "Game:7542ccd5-0d36-4938-9362-b41317f3d29b":3,
  "Game:81854969-bc03-421f-877d-bbc40ddcc595":3,
  "Game:878405fb-28b3-4955-926a-fa6a810b6ac1":3,
  "Game:8fd9466a-b748-4897-815d-9295f0ef109d":3,
  "Game:cad2193c-d6aa-4f0c-8d29-3799371dee64":3,
  "Game:cd1125cf-a9e2-49b2-8c48-e7d9bf8d4b51":3,
  "Game:1750a380-7a34-497a-940e-447cf8cbcefa":4,
  "Game:2a924fb1-651e-41a2-b1ec-203f66cb65b7":4,
  "Game:31685422-bde4-4556-a9f4-8e8d6f98b09d":4,
  "Game:4549dfbc-da30-4be9-a0e5-9e7819b22598":4,
  "Game:5c995c21-23bc-4164-8ad7-701cf5a89aca":4,
  "Game:6d0f777c-5758-4e24-b437-7137f53bb933":4,
  "Game:737b78cf-313e-4b47-8a28-48bc786e462e":4,
  "Game:7c905e1f-bf8c-4918-bd82-7a52524a4156":4,
  "Game:961a23f9-8c10-455b-a67c-840ea18b6973":4,
  "Game:34471d59-4ec7-417f-8a95-03fc4bf3f9fd":5,
  "Game:39779974-ddef-4eab-bff4-303b36ce7acf":5,
  "Game:7b793310-00ab-43b9-8559-cd368d1c8821":5,
  "Game:a25c44d1-d2e9-4387-94b2-51a288d9b172":5,
  "Game:b01686e6-031d-4c36-890c-9eedf7e15411":5,
  "Game:ceba65fc-2999-4430-8fa8-cd532293e99e":5,
  "Game:dc5f9a6f-85c3-434e-ac0f-f4a68e183966":5,
  "Game:e363aab2-94d9-4405-9a2e-01c1ae42ba66":5,
  "Game:f792b0ca-23c7-48df-bb47-c92fad311cbc":5,
  "Game:00398562-603f-41f3-9686-c1ff26fb7272":6,
  "Game:178b5583-b2d3-4477-93a4-c6d81c8f6821":6,
  "Game:1c88058b-f8a6-431c-8a45-f392c4514399":6,
  "Game:251a8055-d030-4214-ac18-e3f11fb33538":6,
  "Game:2e235e7e-bf70-4326-a181-859db0d4f0de":6,
  "Game:4d65a401-ff04-475c-98a0-d7351a4baa4d":6,
  "Game:6d64691a-8c05-4f7a-8a1e-c11cdcc7bfe6":6,
  "Game:afb8006a-74bb-4323-844a-f314d890793a":6,
  "Game:eb86e3da-12bf-438b-851c-8ab06c81cf94":6,
  "Game:11ea2c6a-c928-4b5a-bf73-db6f00fe23ce":7,
  "Game:17f2f18b-1c04-44a3-96b3-e76b159c3fda":7,
  "Game:268ebf16-6a2c-4d3e-b618-6a261727e6e8":7,
  "Game:53378d06-91ea-453e-96e8-c41b526cf664":7,
  "Game:5596fce8-c3d4-4fc5-a56b-baef2d4f7e7b":7,
  "Game:55c077c0-3575-4a91-b583-c5041247f2ea":7,
  "Game:582c4c8b-9832-410f-b1b5-11a3f0db4712":7,
  "Game:8208641c-9df1-4fe4-9014-a5e844301316":7,
  "Game:8d6b8c63-e903-400c-b606-ae8d6e44787f":7,
  "Game:309798fa-51b1-4ff4-bc61-f2e69b2cbd46":8,
  "Game:79e0265e-6a72-48bd-a3d1-d8eb15b20253":8,
  "Game:8c288b54-443a-4aeb-86ad-37b116cec126":8,
  "Game:a179b4f1-25c5-4a7c-9b6e-dd701ef77ce4":8,
  "Game:a6e5c0f3-b7be-4946-8ec3-56044a6ef1a9":8,
  "Game:b27a3aab-5b07-4810-9f03-bad0fed75062":8,
  "Game:b7c9c2ff-0169-418a-b1fc-bae643cfc934":8,
  "Game:bbdfd490-3e60-4b59-adb9-6df97945585d":8,
  "Game:ea1b06ec-468c-4f52-bc1d-af183cf91391":8,
  "Game:31088374-d088-447d-92fc-719c9501c8ab":9,
  "Game:44c70d31-1d5a-458b-b664-e5cac746696a":9,
  "Game:75af8e5b-782b-4ac2-b0f6-71743790642a":9,
  "Game:9739368a-87c2-4122-8c8c-c9460983e491":9,
  "Game:977a5a28-63d4-43a5-b373-e783297605c2":9,
  "Game:bb855431-933d-4e39-bc18-2c18efd2c808":9,
  "Game:bedd356a-cf1f-4ca9-a0ba-1ad2dc1295e9":9,
  "Game:dd1a09d9-ca99-4a2f-ad1c-dbaad5e69d28":9,
  "Game:ffe030bb-46f4-45ab-953a-2184f7a546b0":9,
  "Game:15fac63f-5eac-4afc-8795-6e6efe815933":10,
  "Game:22888e45-6019-4b78-a87e-d00652d1acc1":10,
  "Game:2e0dcb82-e68a-47ba-9f3a-77afc76c1f8e":10,
  "Game:3e84e062-6692-49e8-ad03-3df2ed1d51b4":10,
  "Game:938dacf9-b16a-4790-ab7f-9e31d0fdc724":10,
  "Game:94c64bf9-f218-4845-af04-4562f52841d0":10,
  "Game:a3d61571-82b4-4ba2-85bf-58717a43fd2c":10,
  "Game:b62a1562-c24c-4f03-953a-f0f8b0ef3b61":10,
  "Game:dffb13f7-1dc2-49f8-844f-caf7971780d2":10,
  "Game:0f35b9c5-10d9-4948-a0c1-88aacdd42d15":11,
  "Game:2a170e64-b212-4b7f-ab4d-0e25403fb777":11,
  "Game:312ea8b7-347e-4368-aff5-12d96b5e5615":11,
  "Game:4d84e133-e965-4edd-8b68-1fd6d1a745ce":11,
  "Game:5a1e3f37-65ae-464e-94a2-41dfa3e055cd":11,
  "Game:6a68a851-599e-4b58-8a8e-7ca88545a6cf":11,
  "Game:c5b313f1-6047-40ec-952f-382b8103b7e8":11,
  "Game:c6622514-b727-4663-aaea-71387cd9bc09":11,
  "Game:c7d27bae-b973-4a02-81d0-f0c8f80d02ab":11,
  "Game:20ab0e52-d180-474f-b22c-39b9fe9b7363":12,
  "Game:29755256-51a4-47e4-a94d-ec76dc6ad369":12,
  "Game:2d867bb9-e931-4945-bfbf-fbb0d7663b93":12,
  "Game:316cadfa-acad-4b8f-b440-10372e7eb50b":12,
  "Game:7d601b52-c554-481f-b71a-813e494a486d":12,
  "Game:8fc69596-2359-4385-b935-51240ee466d9":12,
  "Game:9e08d372-fd60-4072-8322-2531f2cd610d":12,
  "Game:bf214e6c-6e0a-4a85-87a1-6871c288e21a":12,
  "Game:fe9dbfb6-cc31-427b-a78d-a172adfc87ea":12,
  "Game:0a34c296-b6c6-4ca9-8c08-c5b71f49142a":13,
  "Game:2bcfe2e9-1b2c-4b1c-a7b9-0c6d8a85fbf9":13,
  "Game:648b943e-592d-420c-8c84-8e2f087915ad":13,
  "Game:7a55a2e2-7957-4dc0-ba0f-eda755fb869f":13,
  "Game:7c1766f1-b8e2-4cc1-bf46-c51f5f407cce":13,
  "Game:a1a2abef-0c1c-42af-a3d0-919fa3ecf3ea":13,
  "Game:a61873c1-f596-48b0-b973-8095c8a66ee8":13,
  "Game:d3154731-38b0-407d-9e64-3b3d3d05199c":13,
  "Game:f35fcf0b-3b7d-4f8d-a780-c2fb6fe30130":13,
  "Game:00dc20f7-1b22-4061-b6ab-7259c7001680":14,
  "Game:1e3b210e-c2ac-4351-950b-6954a0e51344":14,
  "Game:332c29df-cb71-4bfe-8455-5867ee36681c":14,
  "Game:407643d5-a973-4280-bfea-41d4d6a69ba8":14,
  "Game:59192805-b84a-4387-83f4-1c83135081d9":14,
  "Game:9806d2b0-daf1-4aaf-aa0c-e1a2ee5597e0":14,
  "Game:ce56ec74-7672-4bdf-ae4a-9aa95a771414":14,
  "Game:d7bbccec-e684-49f5-b0f8-ad436a6749ad":14,
  "Game:e8dcdccf-e583-4d9b-8fa5-e6a1a63a04d8":14,
  "Game:352a9d89-b593-4ac8-9cef-8e63afbd3aba":15,
  "Game:67736e5a-06fa-482b-8e72-82159b45950c":15,
  "Game:8a4c9168-a655-4d63-95bb-5bd65caf4a9d":15,
  "Game:91b2495a-1f15-4ffc-a910-dfca6d7848b6":15,
  "Game:91cbc0e4-351d-4355-95cf-edc5f921002d":15,
  "Game:97c115b9-6d2c-44ce-a069-dfd19a4c41cc":15,
  "Game:a02b761d-46dd-4a35-8f40-a3aae28eab57":15,
  "Game:a8e5aeac-28d5-48d7-a1b7-7152e8063561":15,
  "Game:b76f9754-0e68-4887-a0ed-1e83529c6a4c":15,
  "Game:1a8c5488-137e-4bdf-bab1-ebcf8e1ffd58":16,
  "Game:65b98c9e-1931-48a7-99e0-ed53391e289d":16,
  "Game:72da073e-816b-43f0-affe-2045afec5324":16,
  "Game:8332c788-13bd-45a6-943d-fa69555fa471":16,
  "Game:8e8026d8-fd19-4800-ab36-fe0cf82cf29c":16,
  "Game:a73e4b4a-c0f1-4c3a-85d4-1b25baf0927c":16,
  "Game:a7603240-365a-4654-b5eb-9edd68152ec6":16,
  "Game:c7bbfefb-0b9f-44d4-8274-43a08bd537b7":16,
  "Game:f1e383be-e085-4b80-a4a3-d6a9dbe84db1":16,
  "Game:06316f2a-2558-4ca7-815f-88d91254f30a":17,
  "Game:095d2bc3-bac4-4445-821b-6fc3d8601906":17,
  "Game:1614b92a-ba72-4416-bc75-c6af57dff7e6":17,
  "Game:2a148694-d471-401d-808c-84ba5be74688":17,
  "Game:3364fe53-65c0-4973-bff1-e2713775d5fb":17,
  "Game:63ab4847-d956-4272-813f-cdc5d9ebf86a":17,
  "Game:77c915ce-2496-4dc1-b27c-32e25dd919b8":17,
  "Game:93890e6d-7e79-4520-9bd2-e10a8c66a24a":17,
  "Game:e9e365ae-6879-48d3-ba84-906a643b4ea7":17,
  "Game:2af9515f-7803-428e-8191-0e45ea064d24":18,
  "Game:39f4f8cb-c9eb-44d9-bcb0-d56998748f73":18,
  "Game:723312cf-0b4b-41b1-84ec-42563733cd44":18,
  "Game:7adb71b0-e4fd-4776-a28b-86e6c54b9463":18,
  "Game:83839b5f-fd04-484d-b45e-0ce34212fa5d":18,
  "Game:83af5ce7-697e-4297-9bfe-884ee9eaba9b":18,
  "Game:8864e103-a9ed-4ba2-8610-ba3b6b27950e":18,
  "Game:987394e8-47c7-4568-8180-572d64519f6c":18,
  "Game:e7117420-dec5-45d3-907c-adf85dfa2fb8":18,
  "Game:6a4a6d25-1855-40a3-a3bb-e1ede4b5f272":19,
  "Game:734cf492-131d-4918-9796-8ab655ec913a":19,
  "Game:737c9b87-4b72-435e-a3a8-d405a440cced":19,
  "Game:9e04a0dc-80ea-41b4-a8f2-69b9b7e6515b":19,
  "Game:a26d608e-5263-4c5c-a256-fa5ade1aa625":19,
  "Game:c4174562-566a-4270-81f1-857c0f922fce":19,
  "Game:d6f25bb4-da07-4cad-96bf-5ec3bb7c9515":19,
  "Game:f772659f-cae1-46f6-b665-8ab81d586541":19,
  "Game:fe558fe0-e25d-42a4-a309-537304397b81":19,
  "Game:0c7ef88e-6508-4e43-ab08-05371e94860b":20,
  "Game:0ca569fb-3c40-4b7a-9a92-1dc76ea42950":20,
  "Game:299826cc-2c24-4be2-a4ca-73c7e8a53701":20,
  "Game:51fd2f90-fe54-4c2e-9e1e-79961881f90b":20,
  "Game:a0b04172-0cb3-4c7f-99d8-24f3faeb6f9e":20,
  "Game:b5ef574a-3484-4c48-829a-890b048a1037":20,
  "Game:cac2721e-17d8-47e1-ab2a-ffbcab3693bc":20,
  "Game:e468abdd-f5b0-473f-a546-042eeb583344":20,
  "Game:e81f924c-f372-4280-a7a9-5dc26582c6f7":20,
  "Game:0f914153-5d17-41bd-a851-f3ef89a93a90":21,
  "Game:3298f1a6-f6e7-4a83-ba96-7cf4fd88dfee":21,
  "Game:41199938-0ccf-4bfc-89a4-175b601fdb55":21,
  "Game:75d525ac-1877-4dc1-bc92-0c050381b9ab":21,
  "Game:82b8c845-cb5a-4732-a09e-4998e3e16557":21,
  "Game:843fb0da-1b20-4ae2-991e-b5b864bc0fcd":21,
  "Game:b922750b-d796-48cf-933b-e464a24911b6":21,
  "Game:d2674089-cd8d-4438-968a-ba044d60f791":21,
  "Game:e60ca8bb-378a-476a-89bd-93d94c229f8a":21,
  "Game:49c28f52-30c7-4fdc-8e08-e0a4a23f2813":22,
  "Game:5ade5bfa-74f4-4500-9752-871c4ee26c8e":22,
  "Game:5c529f02-ae6b-4fec-95e1-552d1cdadfa9":22,
  "Game:69d3c58d-9280-4f41-957a-631d4c69e4aa":22,
  "Game:8a8b29ff-27c0-43dc-a827-12a73228d77f":22,
  "Game:adae1967-b4fd-46e8-80d1-e3a16044f497":22,
  "Game:b537b6eb-13d3-4f31-af0b-aec67e9d5a87":22,
  "Game:d8dbe25c-93f0-4148-982e-2180b08240a4":22,
  "Game:f2c498a1-1044-44f3-b478-31378d8916ee":22,
  "Game:13e0b384-a084-42b3-8eaf-f6ac5a63c5e1":23,
  "Game:2ab48d16-93b9-410a-9acd-46357e9399a6":23,
  "Game:3d16694a-675a-43e7-9bab-4b02f9621875":23,
  "Game:467e509c-971f-4ec1-8e26-8437ce99e9e0":23,
  "Game:7d8cd03e-7557-472a-9acd-c64ed5602b36":23,
  "Game:82d685dd-62f4-44ee-93c1-e1a4fb03caa0":23,
  "Game:a07240ef-256b-475f-98cb-84db0ee0f8a1":23,
  "Game:a42537a4-394f-41b5-a6f2-398f03cc3576":23,
  "Game:d0d4c01d-747f-4b7f-87a1-ad54ae398f90":23,
  "Game:14f80c52-88dd-4e40-a0e2-ab6113795abb":24,
  "Game:342803a5-ef67-40ab-b066-389bf9715953":24,
  "Game:9719d778-71bc-4aa2-ad26-2cdf46a917ed":24,
  "Game:996dcf38-30fa-461a-a12b-2a4a487ae1ac":24,
  "Game:9dd710d3-6cb7-40e0-be0b-1d96e5a40422":24,
  "Game:a4d3e6c9-e149-44f5-8ab5-564b31242191":24,
  "Game:cc5d1d09-51d4-40d8-a725-e003beb37fae":24,
  "Game:e6f82721-8afb-4c60-81b7-383767724ffe":24,
  "Game:efcb8927-1042-48ff-a716-906006abea6c":24,
  "Game:02e0ffe7-effd-4482-8461-f952de7dd00e":25,
  "Game:1c1fe72c-6808-49d7-b032-6e08a62a48ed":25,
  "Game:3896f13a-080c-4426-a623-c579ce750268":25,
  "Game:3f73fd90-9769-44f3-9c4d-3bb295a5672e":25,
  "Game:6c6766c1-fa13-4f53-b430-f6e5b6b6055c":25,
  "Game:b09aaa39-f158-4bf3-93db-cb893435b88c":25,
  "Game:d39310bc-c101-49b5-ac9d-3a30d4dd7cd0":25,
  "Game:dd22e175-a2be-4aee-8e99-ecc8ab340c7e":25,
  "Game:fbfed035-4311-4265-8a64-06b6b0b91ba3":25,
  "Game:0e146fde-6c87-40f5-a1eb-d0c37c8fbeb0":26,
  "Game:310c00de-cb78-4147-95ca-997aeeaf8a9c":26,
  "Game:758323d5-3601-4fa3-b984-8d37f30c3b67":26,
  "Game:84b9796a-246b-4290-b4ef-36d26a7a3bb7":26,
  "Game:a2dcc5d4-740d-4883-8b41-a225af8f1558":26,
  "Game:c5603b5f-5f1c-4a30-851c-d9d050e6489a":26,
  "Game:cb70d22a-b7d0-4ee4-ab2c-ee85a984fb23":26,
  "Game:fb38ff58-e970-488e-a89d-172118ae3cc0":26,
  "Game:fbfc869b-21f6-49f7-a142-9bf2435f4dd1":26,
  "Game:175b3441-ed57-4e0b-b56d-db44d925ab3d":27,
  "Game:1d83352d-14d9-45ff-a9f0-dccee8ce1c1a":27,
  "Game:515d55eb-f814-4b0a-b5ec-b7c9e612f14f":27,
  "Game:5678c44b-c152-4795-b1e4-12ff41256434":27,
  "Game:c3619e09-f964-45dc-93e9-6f8d8ff28cc0":27,
  "Game:d17795e3-432e-41b5-afbd-db18c0fb6f3e":27,
  "Game:d3f1c795-300c-40fc-a45a-0ff48448b00f":27,
  "Game:de8e0091-b281-4722-b204-5c5543eb7458":27,
  "Game:e572c5e2-fa39-4638-b88d-c432120301f0":27,
  "Game:23658ccb-69b3-474c-8f07-bb04deed3b66":28,
  "Game:39b09804-01e4-40d4-b4b2-2d78b71a7ad0":28,
  "Game:40d08882-a378-44e6-b262-41f0d26745f3":28,
  "Game:5c8721e7-a9e4-4b47-97a5-b86cfe3e28ba":28,
  "Game:632bf474-f27d-40a5-8a4a-ccc514803139":28,
  "Game:9f8c336b-e367-47de-b853-b2b50eaf5efc":28,
  "Game:c46ee201-3c05-4013-bd24-8533c2bf16d0":28,
  "Game:d89c0ccb-eaa0-470d-ad98-84767e9b81ee":28,
  "Game:deb30f32-3113-49b1-98a6-d8d009ce255c":28,
  "Game:007d0d85-00db-461a-b735-5b8802000db6":29,
  "Game:1b71c3b5-5cdf-4557-a5cb-cf9a256d35d1":29,
  "Game:2ef5c168-7a9d-4035-975a-96d8b16d7a14":29,
  "Game:429863fc-d880-4e45-adce-c262053e0a67":29,
  "Game:a611701e-c579-461b-a4fd-612ca2c8deeb":29,
  "Game:ca0abc0f-7e89-4d22-b293-53f9fa88f786":29,
  "Game:de2ee3f0-df52-4fd5-a944-205fb9c9485a":29,
  "Game:ec343caa-10fe-421f-bac7-f76c7e252479":29,
  "Game:ffa1dd3a-cc3e-4af4-b283-10ada9199253":29,
  "Game:162822cf-8dc8-4a8d-b135-f83f6c3445f0":30,
  "Game:3adeacde-5a2a-4fda-8fa5-dba864dba162":30,
  "Game:3cf4017a-e9b2-4a0f-9d59-4c8e60713ca8":30,
  "Game:5706655e-8055-43ff-9b50-56e591dcdaf0":30,
  "Game:6d519e21-41ae-448a-9a5e-2fe5e71a0d66":30,
  "Game:905521fd-3736-475f-bdfe-2b70acae31d3":30,
  "Game:90592042-a0d8-4c16-b781-0581214d0bb1":30,
  "Game:c9596484-5df1-4e2a-8ac0-e145630f2f7b":30,
  "Game:e03ada7d-e240-40ac-8169-52e2289b82be":30,
  "Game:0a576d02-cbcf-42a9-b07e-dd81d519202d":31,
  "Game:1d425beb-da10-4792-97d4-97966452faab":31,
  "Game:5910e6bd-2bde-4adf-808c-cfd57ceb0635":31,
  "Game:5c854291-8869-4df5-9e76-fc68d1f2c21e":31,
  "Game:c8588b1e-af11-4b39-81c6-06ee6f9dcd55":31,
  "Game:cb07f917-5348-4a19-937b-f24fc10f0dca":31,
  "Game:f72f9d20-56d2-4688-9d2f-f4dbe3b526da":31,
  "Game:faae4091-bd9f-4808-9163-5fcf8c013575":31,
  "Game:fd928b3d-1b53-44dd-9b13-2829a703ae79":31,
  "Game:0ea78308-eb45-4fbd-a3ba-5f61d120d2a0":32,
  "Game:59768c23-4741-4f05-a2f1-536a03b76b2c":32,
  "Game:5d509efd-34ac-4cf0-9641-36c69588b571":32,
  "Game:82998cca-1afb-499c-8e0f-8a61ddda95f7":32,
  "Game:8d324a39-00af-488e-a5d9-236189b55b34":32,
  "Game:97ce8a4e-c523-42c6-877c-b2e4771edbdf":32,
  "Game:aec6716f-fdf0-48d2-a571-fd6cfde1e9bb":32,
  "Game:e7f51407-3abc-4581-80cb-79c248eba632":32,
  "Game:f8fb4062-0655-497c-8334-c78078cf7853":32,
  "Game:0b400f3b-a540-40b3-aca3-fbc43e1f41ad":33,
  "Game:287b96af-f866-4af4-808b-401b5ee71a4d":33,
  "Game:35244d68-6cd6-4592-a1de-95814cc8a1b7":33,
  "Game:4ec8c978-259c-4b08-84b5-1e647f7a489f":33,
  "Game:5ae2cdc0-de05-45aa-bab4-c0d4f83de441":33,
  "Game:70c5a84c-bfb4-42b1-af23-10a5d4348b1f":33,
  "Game:7385ab68-aad2-4f3b-ab3d-e38b36191399":33,
  "Game:92e14039-f14d-4715-a1f8-66b27a03d032":33,
  "Game:c3ba06e2-fe6a-44d6-a88b-e8a609cb72a0":33,
  "Game:00163d59-f1b6-424e-9526-a163fb64610e":34,
  "Game:116999be-6f78-4da6-989c-597f73d8415e":34,
  "Game:4033529d-2990-4bd9-ad5b-e0f8b5b25a39":34,
  "Game:55cd1dce-6393-4002-b3b5-a12aff899c31":34,
  "Game:6e3cf06f-5c03-4415-977c-0ca2d21f5d20":34,
  "Game:814f7e8d-c9f2-4e68-86e6-c8257f9dac3b":34,
  "Game:b6e4b63c-fc95-4eaa-8986-9a09c3ca6483":34,
  "Game:e5f6a96a-6832-4105-a58e-dfe25221f4f9":34,
  "Game:e68416eb-dc50-4a87-b541-3f31ae522f51":34
};

function assignRounds(games:any[]){
  if(games.length !== 306){
    throw new Error(`JPL-kalender bevat ${games.length} wedstrijden; verwacht exact 306 voor 34 speeldagen.`);
  }

  const grouped = Array.from({length:34},() => [] as any[]);
  const unknown:string[] = [];
  const seen = new Set<string>();

  for(const game of games){
    const providerId = String(game.id || "");
    const round = ROUND_BY_GAME_ID[providerId];
    if(!round){
      unknown.push(providerId || "(zonder id)");
      continue;
    }
    grouped[round-1].push(game);
    seen.add(providerId);
  }

  const missingMapped = Object.keys(ROUND_BY_GAME_ID).filter(id => !seen.has(id));
  if(unknown.length || missingMapped.length){
    throw new Error(
      `Sorare-kalender is gewijzigd. Onbekende wedstrijden: ${unknown.length}; ontbrekende gekende wedstrijden: ${missingMapped.length}. Werk de 2026/27 round-map bij.`
    );
  }

  return grouped.map((roundGames,index) => {
    const teams = new Set<string>();
    for(const game of roundGames){
      const home = String(game.homeTeam?.id || game.homeTeam?.slug || "");
      const away = String(game.awayTeam?.id || game.awayTeam?.slug || "");
      if(!home || !away) throw new Error(`Speeldag ${index+1} bevat een wedstrijd zonder twee clubs.`);
      teams.add(home);
      teams.add(away);
    }
    if(roundGames.length !== 9 || teams.size !== 18){
      throw new Error(`Speeldag ${index+1} is ongeldig: ${roundGames.length} wedstrijden en ${teams.size} unieke clubs.`);
    }
    return {number:index+1,games:roundGames};
  });
}

Deno.serve(async request => {
  if(request.method !== "POST") return new Response("Method not allowed",{status:405});
  const started = Date.now();

  try{
    const db = createClient(
      env("SUPABASE_URL"),
      env("SUPABASE_SERVICE_ROLE_KEY"),
      {auth:{persistSession:false}}
    );

    // De Edge Function staat op verify_jwt=false zodat pg_cron hem kan oproepen.
    // Alleen de random server-side cron secret uit de database krijgt toegang.
    const providedCronSecret = request.headers.get("x-fantasy-cron-secret") || "";
    const {data:cronAuth,error:cronAuthError} = await db
      .from("sync_cron_auth")
      .select("secret")
      .eq("id",1)
      .maybeSingle();
    if(cronAuthError || !cronAuth?.secret || !providedCronSecret || providedCronSecret !== cronAuth.secret){
      return Response.json({ok:false,error:"Unauthorized sync request."},{status:401});
    }

    const apiKey = env("SORARE_API_KEY");

    let apiCalls = 0;
    const sorare = async (query:string, variables:Record<string,unknown>={}) => {
      apiCalls += 1;
      for(let attempt=0;attempt<3;attempt++){
        const response = await fetch(SORARE_GRAPHQL,{
          method:"POST",
          headers:{
            "content-type":"application/json",
            "APIKEY":apiKey,
            "User-Agent":"Fantasy-JPL/1.0"
          },
          body:JSON.stringify({query,variables})
        });

        if(response.status === 429 && attempt < 2){
          const waitSeconds = Math.max(1,num(response.headers.get("retry-after")) || 2);
          await new Promise(resolve => setTimeout(resolve,waitSeconds*1000));
          continue;
        }

        const body = await response.json();
        if(!response.ok) throw new Error(`Sorare HTTP ${response.status}: ${JSON.stringify(body)}`);
        if(body.errors?.length){
          throw new Error(`Sorare GraphQL: ${body.errors.map((e:any)=>e.message).join(" | ")}`);
        }
        return body.data;
      }
      throw new Error("Sorare rate limit bleef actief na retries.");
    };

    let body:any = {};
    try{ body = await request.json(); }catch{ /* lege POST is geldig */ }
    const forcePlayers = body?.refreshPlayers === true;
    // De 3-minuten live-cron gebruikt liveOnly. Die route houdt dezelfde
    // Sorare-statussync, maar beperkt de zware spelerstat-query tot de clubs
    // die op dat moment spelen of net klaar zijn.
    const liveOnly = body?.liveOnly === true;

    const {data:existingPlayers,error:existingPlayersError} = await db
      .from("players")
      .select("id,name,price,provider_player_id");
    if(existingPlayersError) throw existingPlayersError;

    const priceByName = new Map(
      (existingPlayers || []).map((p:any) => [normalizeName(p.name),Number(p.price)])
    );
    const sorareAlreadyLoaded = (existingPlayers || []).some((p:any) => String(p.id).startsWith("sorare-"));
    const unsafeProviderIds = (existingPlayers || []).some((p:any) =>
      String(p.id).startsWith("sorare-") && Math.abs(Number(p.provider_player_id || 0)) > Number.MAX_SAFE_INTEGER
    );
    const playersNeedRefresh = forcePlayers || !sorareAlreadyLoaded || unsafeProviderIds;

    const competitionQuery = `
      query {
        football {
          competition(slug:"${COMPETITION_SLUG}") {
            id
            name
            slug
            openForGameStats
            teams(first:30) {
              nodes {
                __typename
                ... on Club { id name slug }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      }
    `;
    const competitionData = await sorare(competitionQuery);
    const competition = competitionData?.football?.competition;
    if(!competition) throw new Error("Sorare gaf de Jupiler Pro League niet terug.");
    if(!competition.openForGameStats) throw new Error("Sorare markeert de Jupiler Pro League niet als openForGameStats.");

    const clubs = (competition.teams?.nodes || [])
      .filter((team:any) => team?.__typename === "Club" && team.slug);

    if(clubs.length !== 18){
      throw new Error(`Sorare gaf ${clubs.length} JPL-clubs terug; verwacht 18.`);
    }

    let importedPlayers = 0;
    if(playersNeedRefresh){
      const rows:any[] = [];
      for(const club of clubs){
        const rosterData = await sorare(`
          query Roster($slug:String!) {
            football {
              club(slug:$slug) {
                id
                name
                slug
                activePlayers(first:50) {
                  nodes {
                    id
                    slug
                    displayName
                    position
                    gameplayTierStars
                    lastFifteenSo5Appearances
                  }
                  pageInfo { hasNextPage endCursor }
                }
              }
            }
          }
        `,{slug:club.slug});

        const sourceClub = rosterData?.football?.club;
        if(!sourceClub) throw new Error(`Sorare kon club ${club.slug} niet laden.`);

        for(const player of sourceClub.activePlayers?.nodes || []){
          const position = positionCode(player.position);
          if(!position || !player.slug) continue;
          const existingPrice = priceByName.get(normalizeName(player.displayName));
          rows.push({
            id:playerDbId(player.slug),
            provider_player_id:stableBigint(`sorare-player:${player.id || player.slug}`),
            name:player.displayName,
            club_id:stableBigint(`sorare-club:${sourceClub.id}`),
            club_name:sourceClub.name,
            position,
            minutes:0,
            price:existingPrice ?? startingPrice(
              position,
              player.displayName,
              player.lastFifteenSo5Appearances,
              player.gameplayTierStars
            ),
            active:true,
            updated_at:new Date().toISOString()
          });
        }
      }

      if(rows.length < 270){
        throw new Error(`Sorare roster-import gaf slechts ${rows.length} bruikbare JPL-spelers terug.`);
      }

      const {error:deactivateError} = await db.from("players").update({active:false}).eq("active",true);
      if(deactivateError) throw deactivateError;

      for(const part of chunks(rows,200)){
        const {error} = await db.from("players").upsert(part,{onConflict:"id"});
        if(error) throw error;
      }
      importedPlayers = rows.length;
    }

    const fetchGames = async (field:"pastGames"|"futureGames") => {
      const collected:any[] = [];
      let after:string|null = null;
      for(let page=0;page<20;page++){
        const data = await sorare(`
          query Games($after:String) {
            football {
              competition(slug:"${COMPETITION_SLUG}") {
                ${field}(first:${GAME_PAGE_SIZE},after:$after) {
                  nodes {
                    id
                    date
                    statusTyped
                    minute
                    homeScore
                    awayScore
                    homeTeam {
                      __typename
                      ... on Club { id name slug }
                    }
                    awayTeam {
                      __typename
                      ... on Club { id name slug }
                    }
                  }
                  pageInfo { hasNextPage endCursor }
                }
              }
            }
          }
        `,{after});

        const connection = data?.football?.competition?.[field];
        const nodes = connection?.nodes || [];
        collected.push(...nodes);

        if(!connection?.pageInfo?.hasNextPage || !connection.pageInfo.endCursor) break;

        const times = nodes.map((g:any)=>new Date(g.date).getTime()).filter(Number.isFinite);
        if(field === "pastGames" && times.length && Math.max(...times) < SEASON_FROM) break;
        if(field === "futureGames" && times.length && Math.min(...times) >= SEASON_TO) break;

        after = connection.pageInfo.endCursor;
      }
      return collected;
    };

    const [pastGames,futureGames] = await Promise.all([
      fetchGames("pastGames"),
      fetchGames("futureGames")
    ]);

    const gameMap = new Map<string,any>();
    for(const game of [...pastGames,...futureGames]){
      const time = new Date(game.date).getTime();
      if(!Number.isFinite(time) || time < SEASON_FROM || time >= SEASON_TO) continue;
      if(!game.id || !game.homeTeam?.id || !game.awayTeam?.id) continue;
      gameMap.set(String(game.id),game);
    }

    const games = [...gameMap.values()];
    const providerGameByFixtureId = new Map(
      games.map((game:any) => [String(fixtureDbId(String(game.id))),game])
    );
    if(games.length < 100){
      throw new Error(`Sorare gaf slechts ${games.length} wedstrijden voor seizoen 2026/27 terug.`);
    }

    const rounds = assignRounds(games);
    const scheduledGameweeks = rounds.length;
    const playedGameweeks = rounds.filter(
      r=>r.games.length===9 && r.games.every(g=>String(g.statusTyped).toLowerCase()==="played")
    ).length;
    if(scheduledGameweeks !== 34){
      throw new Error(`Verwacht 34 JPL-speeldagen, kreeg ${scheduledGameweeks}.`);
    }

    const now = Date.now();
    const gameweekRows = rounds.map(round => {
      const times = round.games.map(g=>new Date(g.date).getTime()).filter(Number.isFinite);
      const lockAt = Math.min(...times);
      const finished = round.games.length === 9 && round.games.every(g=>String(g.statusTyped).toLowerCase()==="played");
      const started = Number.isFinite(lockAt) && now >= lockAt;
      return {
        season:SEASON_START,
        number:round.number,
        name:`Speeldag ${round.number}`,
        lock_at:new Date(lockAt).toISOString(),
        status:finished ? "finished" : started ? "active" : "upcoming"
      };
    });

    const {data:gameweeks,error:gameweekError} = await db
      .from("gameweeks")
      .upsert(gameweekRows,{onConflict:"season,number"})
      .select("id,number,status,lock_at");
    if(gameweekError) throw gameweekError;

    const gameweekIds = new Map((gameweeks || []).map((g:any)=>[Number(g.number),Number(g.id)]));

    // De eerste Sorare-versie gebruikte 63-bit hashes. Die kunnen bij JSON -> JavaScript
    // afgerond worden, waardoor player stats nooit aan de juiste fixture gekoppeld raakten.
    // Ruim die legacy fixtures éénmalig op; ON DELETE CASCADE verwijdert ook lege/oude stats.
    const seasonGameweekIds = [...gameweekIds.values()];
    let migratedUnsafeFixtureIds = false;
    if(seasonGameweekIds.length){
      const {data:existingSeasonFixtures,error:existingFixtureError} = await db
        .from("fixtures")
        .select("id")
        .in("gameweek_id",seasonGameweekIds)
        .limit(1000);
      if(existingFixtureError) throw existingFixtureError;

      const hasUnsafeFixtureIds = (existingSeasonFixtures || []).some((fixture:any) =>
        Math.abs(Number(fixture.id || 0)) > Number.MAX_SAFE_INTEGER
      );
      if(hasUnsafeFixtureIds){
        const {error:cleanupError} = await db
          .from("fixtures")
          .delete()
          .in("gameweek_id",seasonGameweekIds);
        if(cleanupError) throw cleanupError;
        migratedUnsafeFixtureIds = true;
      }
    }

    // Verwijder een eventuele foutieve extra speeldag uit de eerdere reconstructie.
    const {error:extraGameweekError} = await db
      .from("gameweeks")
      .delete()
      .eq("season",SEASON_START)
      .gt("number",34);
    if(extraGameweekError) throw extraGameweekError;

    const roundByProviderGame = new Map<string,number>();
    for(const round of rounds){
      for(const game of round.games) roundByProviderGame.set(String(game.id),round.number);
    }

    const fixtureRows = games.flatMap(game => {
      const number = roundByProviderGame.get(String(game.id));
      const gameweekId = number ? gameweekIds.get(number) : null;
      if(!gameweekId) return [];
      return [{
        id:fixtureDbId(String(game.id)),
        gameweek_id:gameweekId,
        kickoff:game.date,
        status:statusCode(game.statusTyped),
        live_minute:["playing","live"].includes(String(game.statusTyped).toLowerCase()) ? num(game.minute) : null,
        home_team:game.homeTeam?.name || "Onbekend",
        away_team:game.awayTeam?.name || "Onbekend",
        home_score:["played","playing","live"].includes(String(game.statusTyped).toLowerCase()) ? num(game.homeScore) : null,
        away_score:["played","playing","live"].includes(String(game.statusTyped).toLowerCase()) ? num(game.awayScore) : null,
        updated_at:new Date().toISOString()
      }];
    });

    for(const part of chunks(fixtureRows,200)){
      const {error} = await db.from("fixtures").upsert(part,{onConflict:"id"});
      if(error) throw error;
    }

    // Voorbereiding op Sorare's voorspelde basispercentages.
    // footballPlayingStatusOdds bestaat in het schema, maar kan momenteel null
    // teruggeven. Daarom is dit volledig fail-safe: de gewone sync blijft werken
    // wanneer Sorare niets terugstuurt of het veld tijdelijk niet resolveert.
    let starterPredictionRowsUpdated = 0;
    let starterPredictionGamesWithData = 0;
    const starterPredictionWarnings:string[] = [];
    const predictionGames = games
      .filter((game:any) => {
        const kickoff = new Date(game.date).getTime();
        if(!Number.isFinite(kickoff) || kickoff <= now) return false;
        // De 2-minuten live-sync begint al 75 minuten vóór de aftrap.
        // In die modus hoeven we alleen de wedstrijden te controleren waarvan
        // de officiële opstelling elk moment gepubliceerd kan worden.
        return !liveOnly || kickoff <= now + 90*60*1000;
      })
      .sort((a:any,b:any) => new Date(a.date).getTime()-new Date(b.date).getTime())
      .slice(0,liveOnly ? 4 : 9);

    for(const game of predictionGames){
      try{
        const providerGameId = String(game.id || "").replace(/^Game:/,"").replace(/["\\]/g,"");
        if(!providerGameId) continue;

        const predictionData = await sorare(`
          query {
            football {
              game(id:"${providerGameId}") {
                playerGameScores {
                  anyPlayer {
                    __typename
                    ... on Player { slug displayName }
                  }
                  anyPlayerGameStats {
                    ... on PlayerGameStats {
                      gameStarted
                      onGameSheet
                      playedInGame
                      formationPlace
                      fieldStatus
                      anyTeam {
                        __typename
                        ... on Club { id name slug }
                      }
                      footballPlayingStatusOdds {
                        starterOddsBasisPoints
                        reliability
                      }
                    }
                  }
                }
              }
            }
          }
        `);

        const rawScores = predictionData?.football?.game?.playerGameScores;
        const scores = Array.isArray(rawScores)
          ? rawScores
          : Array.isArray(rawScores?.nodes) ? rawScores.nodes : [];

        const rawLineupEntries = scores.map((score:any) => {
          const player = score?.anyPlayer;
          const rawStats = Array.isArray(score?.anyPlayerGameStats)
            ? score.anyPlayerGameStats[0]
            : score?.anyPlayerGameStats;
          return {player,rawStats};
        }).filter((entry:any) => entry.player?.slug && entry.rawStats?.anyTeam?.name);

        const homeName = String(game.homeTeam?.name || "");
        const awayName = String(game.awayTeam?.name || "");
        const officialHomeStarters = rawLineupEntries.filter((entry:any) =>
          String(entry.rawStats?.anyTeam?.name || "") === homeName &&
          num(entry.rawStats?.gameStarted) > 0
        );
        const officialAwayStarters = rawLineupEntries.filter((entry:any) =>
          String(entry.rawStats?.anyTeam?.name || "") === awayName &&
          num(entry.rawStats?.gameStarted) > 0
        );
        const officialLineupReady =
          officialHomeStarters.length === 11 &&
          officialAwayStarters.length === 11;

        const predictionRows:any[] = [];
        if(officialLineupReady){
          // Zodra Sorare de officiële opstelling publiceert, wordt die de bron
          // van waarheid vóór de aftrap. Bankspelers op het gamesheet krijgen 0%.
          for(const {player,rawStats} of rawLineupEntries){
            const teamName = String(rawStats?.anyTeam?.name || "");
            if(teamName !== homeName && teamName !== awayName) continue;
            if(!Boolean(rawStats?.onGameSheet) && num(rawStats?.gameStarted) <= 0) continue;
            predictionRows.push({
              fixture_id:fixtureDbId(String(game.id)),
              player_id:playerDbId(String(player.slug)),
              starter_probability:num(rawStats?.gameStarted) > 0 ? 100 : 0,
              reliability:"confirmed",
              source:"sorare-lineup",
              updated_at:new Date().toISOString()
            });
          }
        }else{
          // Tot de officiële XI beschikbaar is blijven de gewone Sorare-odds gelden.
          for(const {player,rawStats} of rawLineupEntries){
            const odds = rawStats?.footballPlayingStatusOdds;
            const rawBasisPoints = odds?.starterOddsBasisPoints;
            if(rawBasisPoints == null || !player?.slug) continue;
            const basisPoints = Number(rawBasisPoints);
            if(!Number.isFinite(basisPoints)) continue;

            predictionRows.push({
              fixture_id:fixtureDbId(String(game.id)),
              player_id:playerDbId(String(player.slug)),
              starter_probability:Math.max(0,Math.min(100,Math.round(basisPoints/100))),
              reliability:odds?.reliability == null ? null : String(odds.reliability),
              source:"sorare",
              updated_at:new Date().toISOString()
            });
          }
        }

        if(predictionRows.length){
          const {error:predictionError} = await db
            .from("fixture_start_predictions")
            .upsert(predictionRows,{onConflict:"fixture_id,player_id"});
          if(predictionError){
            starterPredictionWarnings.push("DB " + providerGameId + ": " + predictionError.message);
          }else{
            starterPredictionRowsUpdated += predictionRows.length;
            starterPredictionGamesWithData += 1;
          }
        }
      }catch(error){
        starterPredictionWarnings.push(
          String(game.id || "?") + ": " + (error instanceof Error ? error.message : String(error))
        );
      }
    }

    const latestCompleted = rounds
      .filter(r=>r.games.length===9 && r.games.every(g=>String(g.statusTyped).toLowerCase()==="played"))
      .sort((a,b)=>b.number-a.number)[0];

    if(!latestCompleted) throw new Error("Geen volledig afgewerkte JPL-speeldag gevonden.");

    const latestCompletedId = gameweekIds.get(latestCompleted.number);
    if(!latestCompletedId) throw new Error("Laatste afgewerkte speeldag ontbreekt in de database.");

    // Verwerk iedere afgewerkte wedstrijd die nog ontbreekt, niet alleen de laatste
    // volledig afgewerkte speeldag. Zo worden ingehaalde of gemiste wedstrijden automatisch
    // bijgewerkt zodra de cron opnieuw draait.
    const liveWindowStart = new Date(now - 4*60*60*1000).toISOString();

    let pendingQuery:any = db
      .from("fixtures")
      .select("id,gameweek_id,kickoff,status,details_processed,home_team,away_team")
      .in("gameweek_id",seasonGameweekIds)
      .eq("stats_processed",false)
      .eq("status","FT")
      .order("kickoff",{ascending:true});
    if(liveOnly) pendingQuery = pendingQuery.gte("kickoff",liveWindowStart);
    const {data:pending,error:pendingError} = await pendingQuery;
    if(pendingError) throw pendingError;

    let pendingDetailsQuery:any = db
      .from("fixtures")
      .select("id,gameweek_id,kickoff,status,details_processed,home_team,away_team")
      .in("gameweek_id",seasonGameweekIds)
      .eq("details_processed",false)
      .eq("status","FT")
      .order("kickoff",{ascending:true});
    if(liveOnly) pendingDetailsQuery = pendingDetailsQuery.gte("kickoff",liveWindowStart);
    const {data:pendingDetails,error:pendingDetailsError} = await pendingDetailsQuery;
    if(pendingDetailsError) throw pendingDetailsError;

    const {data:liveFixtures,error:liveError} = await db
      .from("fixtures")
      .select("id,gameweek_id,kickoff,status,details_processed,home_team,away_team")
      .in("gameweek_id",seasonGameweekIds)
      .eq("status","LIVE")
      .order("kickoff",{ascending:true});
    if(liveError) throw liveError;

    let preMatchFixtures:any[] = [];
    if(liveOnly){
      const {data:preMatch,error:preMatchError} = await db
        .from("fixtures")
        .select("id,gameweek_id,kickoff,status,details_processed,home_team,away_team")
        .in("gameweek_id",seasonGameweekIds)
        .eq("status","NS")
        .gte("kickoff",new Date(now - 10*60*1000).toISOString())
        .lte("kickoff",new Date(now + 90*60*1000).toISOString())
        .order("kickoff",{ascending:true});
      if(preMatchError) throw preMatchError;
      preMatchFixtures = preMatch || [];
    }

    const targetById = new Map<string,any>();
    for(const fixture of pending || []) targetById.set(String(fixture.id),fixture);
    for(const fixture of pendingDetails || []) targetById.set(String(fixture.id),fixture);
    for(const fixture of liveFixtures || []) targetById.set(String(fixture.id),fixture);
    for(const fixture of preMatchFixtures) targetById.set(String(fixture.id),fixture);

    const pendingStatIds = new Set((pending || []).map((f:any)=>String(f.id)));
    const pendingDetailIds = new Set((pendingDetails || []).map((f:any)=>String(f.id)));

    // Geen nieuwe SQL-migratie nodig voor toekomstige scoringwijzigingen:
    // - nieuwe Sorare-statvelden -> bump STAT_SCHEMA_VERSION en refresh alleen die fixtures;
    // - alleen andere puntengewichten -> bump SCORING_VERSION en herbereken uit opgeslagen JSON.
    const finishedFixtures = liveOnly ? [] : fixtureRows.filter((f:any)=>f.status === "FT");
    const finishedFixtureById = new Map(finishedFixtures.map((f:any)=>[String(f.id),f]));
    const versionRows:any[] = [];
    for(const idBatch of chunks(finishedFixtures.map((f:any)=>f.id),75)){
      if(!idBatch.length) continue;
      const {data:rows,error:versionError} = await db
        .from("player_match_stats")
        .select("fixture_id,player_id,minutes,stats,players(position)")
        .in("fixture_id",idBatch)
        .limit(10000);
      if(versionError) throw versionError;
      versionRows.push(...(rows || []));
    }

    const existingStatsByFixturePlayer = new Map(
      versionRows.map((row:any) => [String(row.fixture_id) + "::" + String(row.player_id),row.stats || {}])
    );

    const schemaRefreshIds = new Set<string>();
    for(const row of versionRows){
      const stats = row.stats || {};
      if(Number(stats.statSchemaVersion || 0) !== STAT_SCHEMA_VERSION){
        schemaRefreshIds.add(String(row.fixture_id));
      }
    }
    for(const fixtureId of schemaRefreshIds){
      const fixture = finishedFixtureById.get(fixtureId);
      if(fixture) targetById.set(fixtureId,fixture);
    }

    const scoreOnlyUpdates:any[] = [];
    const scoreOnlyGameweeks = new Set<number>();
    for(const row of versionRows){
      const fixtureId = String(row.fixture_id);
      if(schemaRefreshIds.has(fixtureId)) continue;
      const stats = row.stats || {};
      if(Number(stats.scoringVersion || 0) === SCORING_VERSION) continue;
      const joinedPlayer = Array.isArray(row.players) ? row.players[0] : row.players;
      const position = String(joinedPlayer?.position || "");
      if(!weights[position]) continue;
      scoreOnlyUpdates.push({
        fixture_id:row.fixture_id,
        player_id:row.player_id,
        minutes:row.minutes,
        stats:{...stats,scoringVersion:SCORING_VERSION},
        fantasy_points:fantasyScore(position,stats),
        updated_at:new Date().toISOString()
      });
      const fixture = finishedFixtureById.get(fixtureId);
      if(fixture) scoreOnlyGameweeks.add(Number(fixture.gameweek_id));
    }

    let processedFixtures = 0;
    let importedPlayerRows = 0;
    let rescoredPlayerRows = 0;
    const incompleteFixtures:string[] = [];
    const touchedGameweeks = new Set<number>();

    for(const part of chunks(scoreOnlyUpdates,200)){
      const {error} = await db.from("player_match_stats").upsert(part,{onConflict:"fixture_id,player_id"});
      if(error) throw error;
      rescoredPlayerRows += part.length;
    }
    for(const id of scoreOnlyGameweeks) touchedGameweeks.add(id);

    let participantCardsCreated = 0;
    const participantDiscoveryWarnings:string[] = [];
    const statRows:any[] = [];
    const statRowKeys = new Set<string>();
    const rowCountByFixture = new Map<string,number>();
    const starterCountByFixtureTeam = new Map<string,number>();

    if(targetById.size){
      const targetClubs = [...new Set(
        [...targetById.values()]
          .flatMap((fixture:any) => [fixture.home_team,fixture.away_team])
          .filter(Boolean)
          .map((club:any) => String(club))
      )];

      // Een speler kan in een echte wedstrijd opduiken vóór hij in onze opgeslagen
      // activePlayers-roster staat (transfer, jeugdspeler, late registratie, ...).
      // Lees daarom de gamesheet van elke LIVE/recent-FT match en maak ontbrekende
      // spelerkaarten automatisch aan vóór we gameStats per speler ophalen.
      const knownPlayerIds = new Set((existingPlayers || []).map((p:any)=>String(p.id)));

      for(const fixture of [...targetById.values()]){
        const providerGame = providerGameByFixtureId.get(String(fixture.id));
        const providerGameId = String(providerGame?.id || "").replace(/^Game:/,"").replace(/["\\]/g,"");
        if(!providerGameId) continue;

        try{
          const participantData = await sorare(`
            query {
              football {
                game(id:"${providerGameId}") {
                  playerGameScores {
                    anyPlayer {
                      __typename
                      ... on Player {
                        id
                        slug
                        displayName
                        position
                        gameplayTierStars
                        lastFifteenSo5Appearances
                      }
                    }
                    anyPlayerGameStats {
                      ... on PlayerGameStats {
                        id
                        minsPlayed
                        fieldStatus
                        formationPlace
                        gameStarted
                        onGameSheet
                        playedInGame
                        saves
                        savedIbox
                        punches
                        cleanSheet
                        goalsConceded
                        fouls
                        wasFouled
                        yellowCard
                        redCard
                        goals
                        goalAssist
                        wonTackle
                        duelWon
                        duelLost
                        totalClearance
                        interceptionWon
                        possWon
                        possLostCtrl
                        accuratePass
                        accurateLongBalls
                        missedPass
                        wonContest
                        ontargetScoringAtt
                        bigChanceCreated
                        successfulFinalThirdPasses
                        bigChanceMissed
                        penaltyWon
                        totalScoringAtt
                        penAreaEntries
                        errorLeadToGoal
                        anyTeam {
                          __typename
                          ... on Club { id name slug }
                        }
                      }
                    }
                  }
                }
              }
            }
          `);

          const rawScores = participantData?.football?.game?.playerGameScores;
          const scores = Array.isArray(rawScores)
            ? rawScores
            : Array.isArray(rawScores?.nodes) ? rawScores.nodes : [];

          const participantRows:any[] = [];
          for(const score of scores){
            const player = score?.anyPlayer;
            const rawStats = Array.isArray(score?.anyPlayerGameStats)
              ? score.anyPlayerGameStats[0]
              : score?.anyPlayerGameStats;
            const team = rawStats?.anyTeam;
            const position = positionCode(player?.position);
            if(
              player?.__typename !== "Player" ||
              !player?.slug ||
              !player?.displayName ||
              !position ||
              team?.__typename !== "Club" ||
              !team?.name
            ) continue;

            const belongsToFixture =
              String(team.name) === String(fixture.home_team) ||
              String(team.name) === String(fixture.away_team);
            const relevantParticipant =
              Boolean(rawStats?.onGameSheet) ||
              Boolean(rawStats?.playedInGame) ||
              num(rawStats?.gameStarted) > 0;
            if(!belongsToFixture || !relevantParticipant) continue;

            const id = playerDbId(String(player.slug));
            const existingPrice = priceByName.get(normalizeName(player.displayName));
            participantRows.push({
              id,
              provider_player_id:stableBigint(`sorare-player:${player.id || player.slug}`),
              name:String(player.displayName),
              club_id:stableBigint(`sorare-club:${team.id || team.slug || team.name}`),
              club_name:String(team.name),
              position,
              price:existingPrice ?? startingPrice(
                position,
                String(player.displayName),
                player.lastFifteenSo5Appearances,
                player.gameplayTierStars
              ),
              active:true,
              updated_at:new Date().toISOString()
            });
            if(!knownPlayerIds.has(id)){
              participantCardsCreated += 1;
              knownPlayerIds.add(id);
            }

            // playerGameScores wordt bij aftrap sneller gevuld dan player.gameStats.
            // Gebruik deze directe wedstrijddata daarom meteen voor LIVE/FT stats.
            const sourceStatus = String(providerGame?.statusTyped || "").toLowerCase();
            if(["played","playing","live"].includes(sourceStatus)){
              const fixtureId = String(fixture.id);
              const statKey = fixtureId + "::" + id;
              if(!statRowKeys.has(statKey)){
                const stats = mapSorareStats(rawStats || {});
                const previousStats = existingStatsByFixturePlayer.get(statKey) || {};
                const sourceMinute = num(providerGame?.minute);
                const fieldStatus = String(rawStats?.fieldStatus || "UNKNOWN");
                const kickoffStarter =
                  previousStats.kickoffStarter === true ||
                  (
                    ["playing","live"].includes(sourceStatus) &&
                    sourceMinute > 0 &&
                    sourceMinute <= 15 &&
                    Number(stats.minutes || 0) > 0 &&
                    fieldStatus === "ON_FIELD"
                  );

                statRows.push({
                  fixture_id:fixtureId,
                  player_id:id,
                  minutes:stats.minutes,
                  stats:{
                    ...previousStats,
                    ...stats,
                    provider:"sorare",
                    sorareStatId:rawStats?.id || null,
                    sorareGameId:providerGame?.id || null,
                    gameMinute:sourceMinute,
                    gameStarted:num(rawStats?.gameStarted),
                    kickoffStarter,
                    formationPlace:rawStats?.formationPlace == null ? null : num(rawStats.formationPlace),
                    preferredFormationPlace:previousStats.preferredFormationPlace ?? null,
                    fieldStatus,
                    onGameSheet:Boolean(rawStats?.onGameSheet),
                    playedInGame:Boolean(rawStats?.playedInGame),
                    teamId:team?.id || null,
                    teamName:team?.name || null,
                    teamSlug:team?.slug || null,
                    statSchemaVersion:STAT_SCHEMA_VERSION,
                    scoringVersion:SCORING_VERSION
                  },
                  fantasy_points:fantasyScore(position,stats),
                  updated_at:new Date().toISOString()
                });
                statRowKeys.add(statKey);
                rowCountByFixture.set(fixtureId,(rowCountByFixture.get(fixtureId)||0)+1);
                if(num(rawStats?.gameStarted) > 0 && team?.name){
                  const starterKey = fixtureId + "::" + String(team.name);
                  starterCountByFixtureTeam.set(
                    starterKey,
                    (starterCountByFixtureTeam.get(starterKey) || 0) + 1
                  );
                }
              }
            }
          }

          if(participantRows.length){
            const {error:participantUpsertError} = await db
              .from("players")
              .upsert(participantRows,{onConflict:"id"});
            if(participantUpsertError) throw participantUpsertError;
          }
        }catch(error){
          participantDiscoveryWarnings.push(
            String(fixture.id) + ": " + (error instanceof Error ? error.message : String(error))
          );
        }
      }

      let activePlayersQuery:any = db
        .from("players")
        .select("id,name,position,club_name")
        .eq("active",true)
        .like("id","sorare-%");
      if(liveOnly && targetClubs.length){
        activePlayersQuery = activePlayersQuery.in("club_name",targetClubs);
      }
      const {data:activePlayers,error:activePlayersError} = await activePlayersQuery;
      if(activePlayersError) throw activePlayersError;

      const slugs = (activePlayers || [])
        .map((p:any)=>String(p.id).replace(/^sorare-/,""))
        .filter(Boolean);

      if(!liveOnly && slugs.length < 270){
        throw new Error(`Database bevat slechts ${slugs.length} actieve Sorare JPL-spelers. Voer eerst refreshPlayers uit.`);
      }
      if(liveOnly && targetClubs.length && slugs.length < 18){
        throw new Error(`Live-sync vond slechts ${slugs.length} spelers voor actieve clubs: ${targetClubs.join(", ")}.`);
      }

      const positionByPlayerId = new Map((activePlayers || []).map((p:any)=>[String(p.id),String(p.position)]));

      for(const batch of chunks(slugs,PLAYER_BATCH_SIZE)){
        const data = await sorare(`
          query PlayerStats($slugs:[String!]!) {
            players(slugs:$slugs) {
              ... on Player {
                id
                slug
                displayName
                position
                gameStats(last:${PLAYER_STATS_LAST},lowCoverage:true) {
                  id
                  minsPlayed
                  fieldStatus
                  formationPlace
                  gameStarted
                  onGameSheet
                  playedInGame
                  saves
                  savedIbox
                  punches
                  cleanSheet
                  goalsConceded
                  fouls
                  wasFouled
                  yellowCard
                  redCard
                  goals
                  goalAssist
                  wonTackle
                  duelWon
                  duelLost
                  totalClearance
                  interceptionWon
                  possWon
                  possLostCtrl
                  accuratePass
                  accurateLongBalls
                  missedPass
                  wonContest
                  ontargetScoringAtt
                  bigChanceCreated
                  successfulFinalThirdPasses
                  bigChanceMissed
                  penaltyWon
                  totalScoringAtt
                  penAreaEntries
                  errorLeadToGoal
                  anyTeam {
                    __typename
                    ... on Club { id name slug }
                  }
                  footballGame {
                    id
                    date
                    minute
                    statusTyped
                    competition { slug }
                  }
                }
              }
            }
          }
        `,{slugs:batch});

        for(const player of data?.players || []){
          if(!player?.slug) continue;
          const playerId = playerDbId(player.slug);
          const position = positionByPlayerId.get(playerId) || positionCode(player.position);
          if(!position) continue;

          const placeCounts = new Map<number,number>();
          for(const historical of player.gameStats || []){
            const sourceGame = historical.footballGame;
            if(sourceGame?.competition?.slug !== COMPETITION_SLUG) continue;
            if(num(historical.gameStarted) <= 0) continue;
            const place = num(historical.formationPlace);
            if(place > 0) placeCounts.set(place,(placeCounts.get(place)||0)+1);
          }
          const preferredFormationPlace = [...placeCounts.entries()]
            .sort((a,b)=>b[1]-a[1] || a[0]-b[0])[0]?.[0] || null;

          for(const raw of player.gameStats || []){
            const sourceGame = raw.footballGame;
            if(sourceGame?.competition?.slug !== COMPETITION_SLUG) continue;

            const fixtureId = fixtureDbId(String(sourceGame.id));
            const targetFixture = targetById.get(fixtureId);
            if(!targetFixture) continue;

            const sourceStatus = String(sourceGame?.statusTyped || "").toLowerCase();
            if(!["played","playing","live"].includes(sourceStatus)) continue;

            const statKey = fixtureId + "::" + playerId;
            if(statRowKeys.has(statKey)) continue;

            const stats = mapSorareStats(raw);
            const previousStats = existingStatsByFixturePlayer.get(statKey) || {};
            const sourceMinute = num(sourceGame.minute);
            const fieldStatus = String(raw.fieldStatus || "UNKNOWN");
            const kickoffStarter =
              previousStats.kickoffStarter === true ||
              (
                ["playing","live"].includes(sourceStatus) &&
                sourceMinute > 0 &&
                sourceMinute <= 15 &&
                Number(stats.minutes || 0) > 0 &&
                fieldStatus === "ON_FIELD"
              );
            statRows.push({
              fixture_id:fixtureId,
              player_id:playerId,
              minutes:stats.minutes,
              stats:{
                ...previousStats,
                ...stats,
                provider:"sorare",
                sorareStatId:raw.id,
                sorareGameId:sourceGame.id,
                gameMinute:sourceMinute,
                gameStarted:num(raw.gameStarted),
                kickoffStarter,
                formationPlace:raw.formationPlace == null ? null : num(raw.formationPlace),
                preferredFormationPlace,
                fieldStatus,
                onGameSheet:Boolean(raw.onGameSheet),
                playedInGame:Boolean(raw.playedInGame),
                teamId:raw.anyTeam?.id || null,
                teamName:raw.anyTeam?.name || null,
                teamSlug:raw.anyTeam?.slug || null,
                statSchemaVersion:STAT_SCHEMA_VERSION,
                scoringVersion:SCORING_VERSION
              },
              fantasy_points:fantasyScore(position,stats),
              updated_at:new Date().toISOString()
            });
            statRowKeys.add(statKey);
            rowCountByFixture.set(fixtureId,(rowCountByFixture.get(fixtureId)||0)+1);
            if(num(raw.gameStarted) > 0 && raw.anyTeam?.name){
              const starterKey = fixtureId + "::" + String(raw.anyTeam.name);
              starterCountByFixtureTeam.set(
                starterKey,
                (starterCountByFixtureTeam.get(starterKey) || 0) + 1
              );
            }
          }
        }
      }

      for(const part of chunks(statRows,200)){
        const {error} = await db.from("player_match_stats").upsert(part,{onConflict:"fixture_id,player_id"});
        if(error) throw error;
      }
      importedPlayerRows = statRows.length;

      // Ook tijdens LIVE-wedstrijden moet het fantasyklassement opnieuw worden
      // berekend. Anders verschijnen nieuwe spelerpunten wel op het veld, maar
      // blijft de speeldagscore in het klassement staan tot de match FT is.
      for(const fixture of [...targetById.values()]){
        const id = String(fixture.id);
        if((rowCountByFixture.get(id) || 0) > 0){
          touchedGameweeks.add(Number(fixture.gameweek_id));
        }
      }

      // Afgewerkte wedstrijden krijgen éénmalig zowel score- als opstellingsstatus.
      for(const fixture of [...targetById.values()]){
        if(String(fixture.status) !== "FT") continue;
        const id = String(fixture.id);
        const count = rowCountByFixture.get(id) || 0;
        const homeStarters = starterCountByFixtureTeam.get(id + "::" + String(fixture.home_team)) || 0;
        const awayStarters = starterCountByFixtureTeam.get(id + "::" + String(fixture.away_team)) || 0;
        if(count < 18 || homeStarters < 11 || awayStarters < 11){
          incompleteFixtures.push(id);
          continue;
        }

        const patch:any = {
          details_processed:true,
          updated_at:new Date().toISOString()
        };
        if(pendingStatIds.has(id)) patch.stats_processed = true;

        const {error} = await db.from("fixtures")
          .update(patch)
          .eq("id",fixture.id);
        if(error) throw error;

        if(pendingStatIds.has(id) || pendingDetailIds.has(id) || schemaRefreshIds.has(id)){
          touchedGameweeks.add(Number(fixture.gameweek_id));
        }
        if(pendingStatIds.has(id)){
          processedFixtures += 1;
        }
      }
    }

    for(const gameweek of gameweeks || []){
      if(gameweek.status === "active"){
        const {error} = await db.rpc("lock_gameweek",{p_gameweek_id:gameweek.id});
        if(error) throw error;
      }
    }

    for(const id of touchedGameweeks){
      const {error} = await db.rpc("recalculate_gameweek_scores",{p_gameweek_id:id});
      if(error) throw error;
    }
    if(touchedGameweeks.size){
      const {error} = await db.rpc("refresh_player_totals");
      if(error) throw error;
    }

    // Marktprijzen worden in PostgreSQL chronologisch herberekend. Dit gebruikt
    // de historische fantasy-punten en bewaart per wedstrijd prijs vóór/na + verschil.
    let marketHistoryRowsUpdated = 0;
    let marketPricesUpdated = 0;
    if(!liveOnly || processedFixtures > 0){
      const {data:marketResult,error:marketError} = await db.rpc("recalculate_market_prices");
      if(marketError) throw marketError;
      const marketRow = Array.isArray(marketResult) ? marketResult[0] : marketResult;
      marketHistoryRowsUpdated = Number(marketRow?.history_rows_updated || 0);
      marketPricesUpdated = Number(marketRow?.players_updated || 0);
    }

    return Response.json({
      ok:true,
      source:"Sorare",
      mode:liveOnly ? "live" : "full",
      competition:COMPETITION_SLUG,
      season:SEASON_START,
      clubs:clubs.length,
      scheduledGameweeks,
      playedGameweeks,
      migratedUnsafeFixtureIds,
      fixtures:fixtureRows.length,
      latestCompletedGameweek:latestCompleted.number,
      pendingGameweeks:[...new Set((pending || []).map((f:any)=>Number(f.gameweek_id)))].length,
      playerRefresh:playersNeedRefresh,
      playersImported:importedPlayers,
      participantCardsCreated,
      participantDiscoveryWarnings,
      pendingFixtures:(pending || []).length,
      liveFixtures:(liveFixtures || []).length,
      preMatchFixtures:preMatchFixtures.length,
      lineupBackfillFixtures:pendingDetailIds.size,
      scoringSchemaRefreshFixtures:schemaRefreshIds.size,
      rescoredPlayerRows,
      marketHistoryRowsUpdated,
      marketPricesUpdated,
      starterPredictionRowsUpdated,
      starterPredictionGamesWithData,
      starterPredictionWarnings,
      processedFixtures,
      incompleteFixtures,
      importedPlayerRows,
      unsupportedScoringStats:["keyPass"],
      apiCalls,
      durationMs:Date.now()-started
    });
  }catch(error){
    console.error(error);
    return Response.json({
      ok:false,
      source:"Sorare",
      error:error instanceof Error ? error.message : String(error)
    },{status:500});
  }
});
