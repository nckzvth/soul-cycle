import { SLOTS } from "../data/Constants.js";
import { ITEMS } from "../data/Items.js";
import { BALANCE } from "../data/Balance.js";

function rarityForSource(source) {
    const tables = BALANCE?.loot?.rarityBySource || {};
    return tables[source] || tables.field || { legendary: 0.005, epic: 0.015, rare: 0.10, uncommon: 0.35 };
}

function rollRarity(source) {
    const t = rarityForSource(source);
    const legendary = Math.max(0, t.legendary || 0);
    const epic = Math.max(0, t.epic || 0);
    const rare = Math.max(0, t.rare || 0);
    const uncommon = Math.max(0, t.uncommon || 0);

    const r = Math.random();
    let acc = legendary;
    if (r < acc) return "legendary";
    acc += epic;
    if (r < acc) return "epic";
    acc += rare;
    if (r < acc) return "rare";
    acc += uncommon;
    if (r < acc) return "uncommon";
    return "common";
}

const LootSystem = {
    loot(forceType, opts = {}) {
        try {
            // Back-compat: allow passing options as first arg.
            let typeArg = forceType;
            let options = opts;
            if (typeArg && typeof typeArg === "object") {
                options = typeArg;
                typeArg = null;
            }

            const type = typeArg || SLOTS[Math.floor(Math.random() * SLOTS.length)];
            const pool = ITEMS[type];
            if (!pool) throw "No pool";
            const tpl = pool[Math.floor(Math.random() * pool.length)];

            const source = options?.source || "field";
            const rarity = rollRarity(source);
            let m = 1;
            if (rarity === "legendary") m = 2.5;
            else if (rarity === "epic") m = 1.8;
            else if (rarity === "rare") m = 1.4;
            else if (rarity === "uncommon") m = 1.2;

            let stats = {};
            for (let k in tpl.stats) stats[k] = Math.ceil(tpl.stats[k] * m);
            return { id: Math.random().toString(36), type: type, name: tpl.base, rarity, stats, cls: tpl.cls, source };
        } catch (e) { return { id: "err", type: "trinket", name: "Scrap", rarity: "common", stats: {} }; }
    }
};

export default LootSystem;
