---
name: AMC equipment options
description: Scope and persistence rules for categories, brands, and models added in the AMC request form.
---

AMC requesters can add equipment categories, brands, and models inline. Persist these as AMC-specific supplemental options; do not write newly added choices into shared HSN/SAC tax configuration. Brand options belong to a category, and model options belong to a category-brand pair.

**Why:** Adding service-request choices should not silently change the organization’s tax/SAC setup or affect unrelated workflows.

**How to apply:** Merge AMC-specific additions with the existing category and brand/model reference lists. Keep custom brand and model values scoped to their parent selection; manage tax categories separately through tax configuration.
