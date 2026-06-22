# Product Terms Patterns

## Goal

Generate consistent product terms and conditions from approved templates while allowing admin review before publishing.

## Pattern Design

Terms patterns should use placeholders from product and business fields.

Example placeholders:

- `{{product_name}}`
- `{{brand}}`
- `{{product_type}}`
- `{{usage_category}}`
- `{{included_items}}`
- `{{warranty_days}}`
- `{{return_days}}`
- `{{safety_warnings}}`
- `{{care_instructions}}`
- `{{expiry_date}}`
- `{{country_of_origin}}`
- `{{seller_name}}`

## Default Pattern

```text
Product: {{product_name}}
Brand: {{brand}}
Type: {{product_type}}
Usage: {{usage_category}}

By purchasing this product, the buyer confirms that they have reviewed the product description, images, specifications, and usage instructions.

Please inspect the item after receiving it. Return or exchange requests must be submitted within {{return_days}} days, subject to shop policy and marketplace rules.

Warranty period: {{warranty_days}} days, unless stated otherwise.

Care and usage instructions:
{{care_instructions}}

Safety notes:
{{safety_warnings}}

Included items:
{{included_items}}
```

## Consumable Or Expiry-Based Pattern

```text
Product: {{product_name}}
Brand: {{brand}}

This product should be used according to the product description and label instructions.

Expiry date or best-before information: {{expiry_date}}

Storage instructions:
{{care_instructions}}

Safety notes:
{{safety_warnings}}

Returns may be limited after opening, use, or damage to original packaging, subject to shop policy and marketplace rules.
```

## Electronics Or Accessory Pattern

```text
Product: {{product_name}}
Brand: {{brand}}

The buyer should confirm compatibility before purchase. Compatibility notes:
{{usage_category}}

Warranty period: {{warranty_days}} days.

Warranty does not cover misuse, accidental damage, unauthorized repair, water damage, or normal wear unless required by law or marketplace policy.

Included items:
{{included_items}}
```

## Review Rules

- Generated terms should be marked `draft` first.
- Admin should review and approve before publishing.
- Every approved terms body should be versioned.
- Changing a pattern should not rewrite old approved product terms automatically.

## Legal Note

These templates are operational drafting aids, not legal advice. Final terms should be checked against the seller's country, Shopee rules, and actual shop policy.
