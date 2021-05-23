import * as axios from 'axios';
import * as cheerio from 'cheerio';
import DBconfig from './DB.json';
import * as mongo from "mongodb";


interface Champion_DB {
    name?: string,
    position?: Array<Champion_position_DB>
}

interface Champion_position_DB {
    type?: "Top" | "Bottom" | "Middle" | "Jungle" | "Support" | string,
    perk: Array<number>,
    primaryKeyStone: number,
    subKeyStone: number,
}

interface Precision {
    [index: string]: any
    keystone?: "Press the Attack" | "Lethal Tempo" | "Fleet Footwork" | "Conqueror",
    slot1?:  "Overheal" | "Triumph" | "Presence of Mind" | string,
    slot2?: "Legend: Alacrity" | "Legend: Tenacity" | "Legend: Bloodline" | string,
    slot3?: "Coup de Grace" | "Cut Down" | "Last Stand" | string
}
interface Domination {
    [index: string]: any
    keystone?: "Electrocute" | "Predator" | "Dark Harvest" | "Hail of Blades",
    slot1?:  "Cheap Shot" | "Taste of Blood" | "Sudden Impact" | string,
    slot2?: "Zombie Ward" | "Ghost Poro" | "Eyeball Collection" | string,
    slot3?: "Ravenous Hunter" | "Ingenious Hunter" | "Relentless Hunter" | string | "Ultimate Hunter"
}
interface Sorcery {
    [index: string]: any
    keystone?: "Summon Aery" | "Arcane Comet" | "Phase Rush",
    slot1?:  "Nullifying Orb" | "Manaflow Band" | "Nimbus Cloak" | string,
    slot2?: "Transcendence" | "Celerity" | "Absolute Focus" | string,
    slot3?: "Scorch" | "Waterwalking" | "Gathering Storm" | string
}
interface Resolve {
    [index: string]: any
    keystone?: "Grasp of the Undying" | "Aftershock" | "Guardian",
    slot1?:  "Demolish" | "Font of Life" | "Shield Bash" | string,
    slot2?: "Conditioning" | "Second Wind" | "Bone Plating" | string,
    slot3?: "Overgrowth" | "Revitalize" | "Unflinching" | string
}
interface Inspiration {
    [index: string]: any
    keystone?: "Glacial Augment" | "Unsealed Spellbook" | "Prototype: Omnistone",
    slot1?:  "Hextech Flashtraption" | "Magical Footwear" | "Perfect Timing" | string,
    slot2?: "Future's Market" | "Minion Dematerializer" | "Biscuit Delivery" | string,
    slot3?: "Cosmic Insight" | "Approach Velocity" | "Time Warp Tonic" | string
}




function GetChampionData(characterName: string): Promise<Champion_DB | undefined> {
    return new Promise(async resolve => {
        let res = await axios.default.get(`https://www.op.gg/champion/${characterName}`);
        const $ = cheerio.load(res.data);
    
        let Champion: Champion_DB = {
            name: characterName,
            position: []
        };
        
        $('div.champion__list--position').children().each(async (idx, elem) => {
            let Position: Champion_position_DB = {
                type: $('a', elem).text().trim(),
                ...await GetChampionRune(characterName, $('a', elem).text().trim())
            }
            
            // console.log(Position)
            Champion.position?.push(Position);
    
            if ($('div.champion__list--position').children().length == Champion.position?.length)
                return resolve(Champion)
        })
        if (!$('div.champion__list--position').children().length) {
            return resolve(undefined);
        }
    })

}

function GetChampionRune(characterName: string, position: string): Promise<Champion_position_DB> {
    return new Promise(async resolve => {
        let res = await axios.default.get(`https://www.op.gg/champion/${characterName}/statistics/${position}`);
        // console.log(res.data)
        const $ = cheerio.load(res.data);
        
        let Position: Champion_position_DB = {
            primaryKeyStone: 0,
            subKeyStone: 0,
            perk: []
        }
        let n = 0;

        $('div.perk-page__item--mark').children('img').each(async (idx, elem) => {
            if (idx > 1) return;
            if (idx == 0) Position.primaryKeyStone = parseInt(($(elem).attr('src') as string).replace(/.*(\d{4})\.png.*/, "$1"));
            if (idx == 1) Position.subKeyStone = parseInt(($(elem).attr('src') as string).replace(/.*(\d{4})\.png.*/, "$1"));

            // console.log(($(elem).attr('src') as string).replace("//opgg-static.akamaized.net/images/lol/perkStyle/", "").replace(/(\.png.*)/, ""))
        })

        $('div.perk-page-wrap').first().children().each(async (idx, elem) => {

            if ($(elem).hasClass("perk-page")) {
                $(elem).children().children().each(async (idx, elem) => { // perk-page__row
                    // console.log(($(elem).first().children().first().children('img').attr('src') as string).replace(/(\d{4})\.png.*/, "$1"))
                    if ($(elem).hasClass("perk-page__item--active")) {
                        let src = $(elem).first().children().first().children('img').attr('src');
                        if (src) {
                            Position.perk.push(parseInt(src.replace(/.*(\d{4})\.png.*/, "$1")));
                        }
                            // console.log(src.replace(/.*(\d{4})\.png.*/, "$1"), $(elem).first().children().first().children('img').attr('class'));
                    }
                })
            }

            if ($(elem).hasClass("fragment-page")) {
                $(elem).children().first().children("div.fragment").each((idx, elem) => {
                    let src = $(elem).children().first().children('img').first().attr('src');
                    if (src) Position.perk.push(parseInt(src.replace(/.*(\d{4})\.png.*/, "$1")));
                })
            }

        });
        // console.log(Position)
        return resolve(Position)
    })
}


function sleep(t:number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, t * 1000);
    })
}


let DB_Client: mongo.MongoClient;


(async () => {
    const DB_config: mongo.MongoClientOptions = {
        useUnifiedTopology: true,
        poolSize: 10
	}
	
	DB_Client = await mongo.MongoClient.connect(`mongodb://${DBconfig.user}:${DBconfig.pwd}@${DBconfig.host}/${DBconfig.DataBase}`, DB_config);
    let DB = await DB_Client.db();

    console.log("Getting HTML data")
    let Version = await axios.default.get("https://ddragon.leagueoflegends.com/api/versions.json");
    Version = Version.data[0];
    console.log(Version)
    let ChampionList = await axios.default.get(`http://ddragon.leagueoflegends.com/cdn/${Version}/data/ko_KR/champion.json`);
    ChampionList = ChampionList.data.data;
    // let n = 0;

    for (const Champion in ChampionList) {

        if (!await DB.collection('Champions').findOne({name: Champion})) {
            // if (n > 2) break;
            
            console.log("Adding", Champion)
            let ChampionInfo = await GetChampionData(Champion);
            if (ChampionInfo) {
                await DB.collection('Champions').insertOne(ChampionInfo);
                // console.log("added", ChampionInfo.name);
                console.log(ChampionInfo)
            } else {
                console.log("Error while Getting Champion Data", Champion);
            }
        } else {

            console.log("Updating", Champion);
            let ChampionInfo = await GetChampionData(Champion);
            if (ChampionInfo) {
                await DB.collection('Champions').updateOne({name: Champion}, {$set: ChampionInfo});
                // console.log("added", ChampionInfo.name);
            } else {
                console.log("Error while Getting Champion Data", Champion);
            }
            // console.log("Skipping", Champion)
            // continue;
        }

        await sleep(1.8)
        // n++;
    }
    DB_Client.close();
})()

