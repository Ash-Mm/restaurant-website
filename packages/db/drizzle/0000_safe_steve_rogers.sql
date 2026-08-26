CREATE TABLE `restaurants` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo_url` text,
	`brand_color` text,
	`default_language` text DEFAULT 'en' NOT NULL,
	`currency` text DEFAULT 'EGP' NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_slug_unique` ON `restaurants` (`slug`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`active` integer DEFAULT 1 NOT NULL,
	`tax_registration_number` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `locations_restaurant_id_idx` ON `locations` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`full_name` text NOT NULL,
	`role` text DEFAULT 'customer' NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `users_restaurant_id_idx` ON `users` (`restaurant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_restaurant_email_unique` ON `users` (`restaurant_id`,`email`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`permissions` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `roles_restaurant_id_idx` ON `roles` (`restaurant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `roles_restaurant_name_unique` ON `roles` (`restaurant_id`,`name`);--> statement-breakpoint
CREATE TABLE `user_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`location_id` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_locations_restaurant_id_idx` ON `user_locations` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `user_locations_location_id_idx` ON `user_locations` (`location_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_locations_user_location_unique` ON `user_locations` (`user_id`,`location_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `settings_restaurant_id_idx` ON `settings` (`restaurant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `settings_restaurant_key_unique` ON `settings` (`restaurant_id`,`key`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`metadata` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_logs_restaurant_id_idx` ON `audit_logs` (`restaurant_id`);