export const SKILLS = [
    { id: "h1", cls: "hammer", name: "Gravity Well", cost: 0, desc: "Spin creates gravity.", mods: { orbitBase: 1 } },
    { id: "h2", cls: "hammer", name: "Event Horizon", cost: 50, req: ["h1"], desc: "+20% Orb Size.", mods: { orbSize: 0.2 } },
    { id: "h3", cls: "hammer", name: "Dense Core", cost: 50, req: ["h1"], desc: "+20% Damage.", mods: { dmgMult: 0.2 } },
    { id: "h4", cls: "hammer", name: "Singularity", cost: 150, req: ["h2", "h3"], desc: "Release pulls enemies.", mods: { singularity: 1 } },
    { id: "p1", cls: "pistol", name: "Ricochet", cost: 0, desc: "Shots bounce 1x.", mods: { hexBounce: 1 } },
    { id: "p2", cls: "pistol", name: "FMJ", cost: 50, req: ["p1"], desc: "+1 Pierce.", mods: { hexPierce: 1 } },
    { id: "p3", cls: "pistol", name: "High Caliber", cost: 50, req: ["p1"], desc: "+15% Dmg.", mods: { dmgMult: 0.15 } },
    { id: "p4", cls: "pistol", name: "Smart Rounds", cost: 150, req: ["p2", "p3"], desc: "Auto-target bounces.", mods: { geometry: 1 } },
    { id: "s1", cls: "staff", name: "Arc", cost: 0, desc: "+1 Chain.", mods: { chainCount: 1 } },
    { id: "s2", cls: "staff", name: "Conductivity", cost: 50, req: ["s1"], desc: "+30% Jump Range.", mods: { chainJump: 0.3 } },
    { id: "s3", cls: "staff", name: "Static Field", cost: 50, req: ["s1"], desc: "Chains apply slow.", mods: { static: 1 } },
    { id: "s4", cls: "staff", name: "Thunderlord", cost: 150, req: ["s2", "s3"], desc: "+2 Chains, +20% Dmg.", mods: { chainCount: 2, chainDmg: 0.2 } }
];