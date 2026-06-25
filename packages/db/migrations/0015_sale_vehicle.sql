-- Repair orders can record which vehicle was serviced (brand · model · year, free text).
ALTER TABLE `onsite_sales` ADD COLUMN `vehicle` text;
