-- database/init.sql
DROP DATABASE IF EXISTS gift_finder;
CREATE DATABASE IF NOT EXISTS gift_finder;
USE gift_finder;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gifts table
CREATE TABLE IF NOT EXISTS gifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_range VARCHAR(50),
  image_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tags table (for interests, age groups, etc.)
CREATE TABLE IF NOT EXISTS tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  category ENUM('age', 'gender', 'interest', 'profession') NOT NULL
);

-- Gift-Tag relationships
CREATE TABLE IF NOT EXISTS gift_tags (
  gift_id INT,
  tag_id INT,
  PRIMARY KEY (gift_id, tag_id),
  FOREIGN KEY (gift_id) REFERENCES gifts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Insert sample data
-- Insert sample tags
INSERT INTO tags (name, category) VALUES
-- Age groups
('children', 'age'),
('teenagers', 'age'),
('young adults', 'age'),
('adults', 'age'),
('seniors', 'age'),
-- Gender
('male', 'gender'),
('female', 'gender'),
('unisex', 'gender'),
-- Interests
('reading', 'interest'),
('gaming', 'interest'),
('cooking', 'interest'),
('sports', 'interest'),
('music', 'interest'),
('art', 'interest'),
('technology', 'interest'),
('travel', 'interest'),
('fashion', 'interest'),
('fitness', 'interest'),
('gardening', 'interest'),
('photography', 'interest'),
-- Professions
('student', 'profession'),
('teacher', 'profession'),
('programmer', 'profession'),
('doctor', 'profession'),
('artist', 'profession'),
('engineer', 'profession'),
('business', 'profession');

-- Insert sample gifts
INSERT INTO gifts (name, description, price_range, image_url) VALUES
('Wireless Headphones', 'High-quality noise-canceling wireless headphones', '$100-$300', 'https://example.com/headphones.jpg'),
('E-reader', 'Digital reading device with paper-like display', '$80-$250', 'https://example.com/ereader.jpg'),
('Smart Watch', 'Fitness and health tracking smartwatch', '$150-$400', 'https://example.com/smartwatch.jpg'),
('Gaming Console', 'Latest gaming console with controllers', '$300-$600', 'https://example.com/console.jpg'),
('Chef Knife Set', 'Professional kitchen knife set', '$100-$300', 'https://example.com/knives.jpg'),
('Yoga Mat', 'Eco-friendly non-slip yoga mat', '$20-$50', 'https://example.com/yogamat.jpg'),
('Digital Camera', 'Compact mirrorless digital camera', '$400-$1000', 'https://example.com/camera.jpg'),
('Art Supplies Set', 'Professional art supplies in a wooden case', '$50-$150', 'https://example.com/artsupplies.jpg'),
('Travel Backpack', 'Ergonomic lightweight travel backpack', '$50-$150', 'https://example.com/backpack.jpg'),
('Programmable Robot Kit', 'Educational robot kit for learning coding', '$80-$200', 'https://example.com/robotkit.jpg'),
('Mechanical Keyboard', 'RGB mechanical keyboard for gaming and programming', '$80-$200', 'https://example.com/keyboard.jpg'),
('Gardening Tool Set', 'Complete set of gardening tools and accessories', '$30-$100', 'https://example.com/gardentools.jpg'),
('Portable Bluetooth Speaker', 'Waterproof portable bluetooth speaker', '$50-$150', 'https://example.com/speaker.jpg'),
('Stylish Watch', 'Classic design wristwatch suitable for any occasion', '$100-$500', 'https://example.com/watch.jpg'),
('Cookbook Collection', 'Set of bestselling cookbooks', '$40-$120', 'https://example.com/cookbooks.jpg');

-- Connect gifts with appropriate tags
-- Wireless Headphones
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(1, (SELECT id FROM tags WHERE name = 'teenagers')),
(1, (SELECT id FROM tags WHERE name = 'young adults')),
(1, (SELECT id FROM tags WHERE name = 'adults')),
(1, (SELECT id FROM tags WHERE name = 'unisex')),
(1, (SELECT id FROM tags WHERE name = 'music')),
(1, (SELECT id FROM tags WHERE name = 'technology'));

-- E-reader
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(2, (SELECT id FROM tags WHERE name = 'young adults')),
(2, (SELECT id FROM tags WHERE name = 'adults')),
(2, (SELECT id FROM tags WHERE name = 'seniors')),
(2, (SELECT id FROM tags WHERE name = 'unisex')),
(2, (SELECT id FROM tags WHERE name = 'reading'));

-- Add more gift-tag connections for the remaining gifts...