import { validateAttributeMasteryTrees } from "../src/data/ValidateAttributeMasteryTrees.js";
import { validateAttributeMasteryEffects } from "../src/data/ValidateAttributeMasteryEffects.js";
import { validateAttributeMasteryLayout } from "../src/data/ValidateAttributeMasteryLayout.js";

validateAttributeMasteryTrees();
validateAttributeMasteryEffects();
validateAttributeMasteryLayout();
console.log("validate_attribute_mastery_trees: OK");
