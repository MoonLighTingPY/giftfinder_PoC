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
('Бездротові навушники', 'Високоякісні шумопоглинаючі бездротові навушники', '$100-$300', NULL),
('Електронна книга', 'Пристрій для читання з екраном, що нагадує папір', '$80-$250', NULL),
('Розумний годинник', 'Смарт-годинник для фітнесу та здоров\'я', '$150-$400', NULL),
('Ігрова консоль', 'Сучасна ігрова консоль з контролерами', '$300-$600', NULL),
('Набір кухонних ножів', 'Професійний набір кухонних ножів', '$100-$300', NULL),
('Килимок для йоги', 'Екологічний нековзкий килимок для йоги', '$20-$50', NULL),
('Цифрова камера', 'Компактна бездзеркальна цифрова камера', '$400-$1000', NULL),
('Набір для художника', 'Професійний набір для малювання в дерев\'яному кейсі', '$50-$150', NULL),
('Туристичний рюкзак', 'Ергономічний легкий рюкзак для подорожей', '$50-$150', NULL),
('Набір для програмування роботів', 'Освітній набір для вивчення програмування', '$80-$200', NULL),
('Механічна клавіатура', 'RGB механічна клавіатура для ігор та програмування', '$80-$200', NULL),
('Набір садових інструментів', 'Повний набір садових інструментів та аксесуарів', '$30-$100', NULL),
('Портативна Bluetooth колонка', 'Водонепроникна портативна Bluetooth колонка', '$50-$150', NULL),
('Стильний годинник', 'Наручний годинник класичного дизайну для будь-якого випадку', '$100-$500', NULL),
('Колекція кулінарних книг', 'Набір популярних кулінарних книг', '$40-$120', NULL);

-- Connect gifts with appropriate tags
-- Wireless Headphones
-- Add these after your existing gift-tag connections

-- Smart Watch
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(3, (SELECT id FROM tags WHERE name = 'young adults')),
(3, (SELECT id FROM tags WHERE name = 'adults')),
(3, (SELECT id FROM tags WHERE name = 'unisex')),
(3, (SELECT id FROM tags WHERE name = 'technology')),
(3, (SELECT id FROM tags WHERE name = 'fitness'));

-- Gaming Console
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(4, (SELECT id FROM tags WHERE name = 'teenagers')),
(4, (SELECT id FROM tags WHERE name = 'young adults')),
(4, (SELECT id FROM tags WHERE name = 'unisex')),
(4, (SELECT id FROM tags WHERE name = 'gaming')),
(4, (SELECT id FROM tags WHERE name = 'technology'));

-- Chef Knife Set
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(5, (SELECT id FROM tags WHERE name = 'adults')),
(5, (SELECT id FROM tags WHERE name = 'unisex')),
(5, (SELECT id FROM tags WHERE name = 'cooking'));

-- Yoga Mat
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(6, (SELECT id FROM tags WHERE name = 'young adults')),
(6, (SELECT id FROM tags WHERE name = 'adults')),
(6, (SELECT id FROM tags WHERE name = 'unisex')),
(6, (SELECT id FROM tags WHERE name = 'fitness'));

-- Digital Camera
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(7, (SELECT id FROM tags WHERE name = 'young adults')),
(7, (SELECT id FROM tags WHERE name = 'adults')),
(7, (SELECT id FROM tags WHERE name = 'unisex')),
(7, (SELECT id FROM tags WHERE name = 'photography')),
(7, (SELECT id FROM tags WHERE name = 'technology')),
(7, (SELECT id FROM tags WHERE name = 'art')),
(7, (SELECT id FROM tags WHERE name = 'travel'));

-- Art Supplies Set
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(8, (SELECT id FROM tags WHERE name = 'teenagers')),
(8, (SELECT id FROM tags WHERE name = 'young adults')),
(8, (SELECT id FROM tags WHERE name = 'adults')),
(8, (SELECT id FROM tags WHERE name = 'unisex')),
(8, (SELECT id FROM tags WHERE name = 'art')),
(8, (SELECT id FROM tags WHERE name = 'artist'));

-- Travel Backpack
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(9, (SELECT id FROM tags WHERE name = 'teenagers')),
(9, (SELECT id FROM tags WHERE name = 'young adults')),
(9, (SELECT id FROM tags WHERE name = 'adults')),
(9, (SELECT id FROM tags WHERE name = 'unisex')),
(9, (SELECT id FROM tags WHERE name = 'travel'));

-- Programmable Robot Kit
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(10, (SELECT id FROM tags WHERE name = 'children')),
(10, (SELECT id FROM tags WHERE name = 'teenagers')),
(10, (SELECT id FROM tags WHERE name = 'unisex')),
(10, (SELECT id FROM tags WHERE name = 'technology')),
(10, (SELECT id FROM tags WHERE name = 'programmer')),
(10, (SELECT id FROM tags WHERE name = 'student'));

-- Mechanical Keyboard
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(11, (SELECT id FROM tags WHERE name = 'teenagers')),
(11, (SELECT id FROM tags WHERE name = 'young adults')),
(11, (SELECT id FROM tags WHERE name = 'adults')),
(11, (SELECT id FROM tags WHERE name = 'unisex')),
(11, (SELECT id FROM tags WHERE name = 'technology')),
(11, (SELECT id FROM tags WHERE name = 'gaming')),
(11, (SELECT id FROM tags WHERE name = 'programmer'));

-- Gardening Tool Set
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(12, (SELECT id FROM tags WHERE name = 'adults')),
(12, (SELECT id FROM tags WHERE name = 'seniors')),
(12, (SELECT id FROM tags WHERE name = 'unisex')),
(12, (SELECT id FROM tags WHERE name = 'gardening'));

-- Portable Bluetooth Speaker
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(13, (SELECT id FROM tags WHERE name = 'teenagers')),
(13, (SELECT id FROM tags WHERE name = 'young adults')),
(13, (SELECT id FROM tags WHERE name = 'adults')),
(13, (SELECT id FROM tags WHERE name = 'unisex')),
(13, (SELECT id FROM tags WHERE name = 'music')),
(13, (SELECT id FROM tags WHERE name = 'technology'));

-- Stylish Watch
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(14, (SELECT id FROM tags WHERE name = 'young adults')),
(14, (SELECT id FROM tags WHERE name = 'adults')),
(14, (SELECT id FROM tags WHERE name = 'unisex')),
(14, (SELECT id FROM tags WHERE name = 'fashion')),
(14, (SELECT id FROM tags WHERE name = 'business'));

-- Cookbook Collection
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(15, (SELECT id FROM tags WHERE name = 'young adults')),
(15, (SELECT id FROM tags WHERE name = 'adults')),
(15, (SELECT id FROM tags WHERE name = 'unisex')),
(15, (SELECT id FROM tags WHERE name = 'cooking')),
(15, (SELECT id FROM tags WHERE name = 'reading'));

-- Add more gift-tag connections for the remaining gifts...
