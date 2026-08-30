CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text,
	`email` text,
	`phone` text,
	`tracking_token_hash` text,
	`tracking_expires_at` text,
	`tracking_revoked_at` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customers_restaurant_id_idx` ON `customers` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `customers_tracking_token_hash_idx` ON `customers` (`tracking_token_hash`);