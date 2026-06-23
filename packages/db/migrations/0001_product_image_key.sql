-- Add product image reference (R2 object key). Image bytes live in the kiraoffice-images
-- R2 bucket; this column stores the key, served back via the api Worker's GET /img/:key route.
ALTER TABLE products ADD COLUMN image_key TEXT;
