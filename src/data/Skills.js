export const SKILLS = [
    { id: "h1", cls: "hammer", name: "Gravity Well", desc: "Spin creates gravity.", mods: { orbitBase: 1 }, max_stacks: 1 },
    { id: "h2", cls: "hammer", name: "Event Horizon", desc: "+20% Orb Size.", mods: { orbSize: 0.2 }, max_stacks: 5 },
    { id: "h3", cls: "hammer", name: "Dense Core", desc: "+20% Damage.", mods: { dmgMult: 0.2 }, max_stacks: 5 },
    { id: "h4", cls: "hammer", name: "Singularity", desc: "Release pulls enemies.", mods: { singularity: 1 }, max_stacks: 1 },
    { id: "p1", cls: "pistol", name: "Ricochet", desc: "Shots bounce 1x.", mods: { hexBounce: 1 }, max_stacks: 3 },
    { id: "p2", cls: "pistol", name: "FMJ", desc: "+1 Pierce.", mods: { hexPierce: 1 }, max_stacks: 5 },
    { id: "p3", cls: "pistol", name: "High Caliber", desc: "+15% Dmg.", mods: { dmgMult: 0.15 }, max_stacks: 5 },
    { id: "p4", cls: "pistol", name: "Smart Rounds", desc: "Auto-target bounces.", mods: { geometry: 1 }, max_stacks: 1 },
    { id: "s1", cls: "staff", name: "Arc", desc: "+1 Chain.", mods: { chainCount: 1 }, max_stacks: 5 },
    { id: "s2", cls: "staff", name: "Conductivity", desc: "+30% Jump Range.", mods: { chainJump: 0.3 }, max_stacks: 3 },
    { id: "s3", cls: "staff", name: "Static Field", desc: "Chains apply slow.", mods: { static: 1 }, max_stacks: 1 },
    { id: "s4", cls: "staff", name: "Thunderlord", desc: "+2 Chains, +20% Dmg.", mods: { chainCount: 2, chainDmg: 0.2 }, max_stacks: 1 }
];