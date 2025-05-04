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


-- Wireless Headphones (gift_id=1)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(1, (SELECT id FROM tags WHERE name = 'teenagers')),
(1, (SELECT id FROM tags WHERE name = 'young adults')),
(1, (SELECT id FROM tags WHERE name = 'adults')),
(1, (SELECT id FROM tags WHERE name = 'unisex')),
(1, (SELECT id FROM tags WHERE name = 'music')),
(1, (SELECT id FROM tags WHERE name = 'technology'));

-- E-reader (gift_id=2)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(2, (SELECT id FROM tags WHERE name = 'young adults')),
(2, (SELECT id FROM tags WHERE name = 'adults')),
(2, (SELECT id FROM tags WHERE name = 'seniors')),
(2, (SELECT id FROM tags WHERE name = 'unisex')),
(2, (SELECT id FROM tags WHERE name = 'reading')),
(2, (SELECT id FROM tags WHERE name = 'technology'));

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

-- Add more diverse gift options
INSERT INTO gifts (name, description, price_range, image_url) VALUES
-- Children gifts
('Конструктор LEGO', 'Набір для розвитку креативності та моторики', '$30-$100', NULL),
('Інтерактивна іграшка', 'Розумна іграшка з освітніми функціями', '$40-$80', NULL),
('Набір для творчості', 'Комплект для малювання та рукоділля', '$20-$60', NULL),
('Дитячий планшет', 'Спеціальний планшет для навчання дітей', '$80-$150', NULL),
('Розвиваюча настільна гра', 'Гра для розвитку логіки та мислення', '$15-$40', NULL),

-- Teenager gifts
('Бездротові навушники для гейминга', 'Ігрові навушники з мікрофоном та RGB підсвіткою', '$60-$150', NULL),
('Рюкзак для підлітків', 'Стильний та місткий рюкзак для школи', '$30-$80', NULL),
('Смарт-годинник для підлітків', 'Водостійкий годинник з трекером активності', '$50-$120', NULL),
('Набір для наукових експериментів', 'Комплект для проведення простих наукових дослідів', '$40-$90', NULL),
('Портативна ігрова консоль', 'Компактна консоль для ігор у дорозі', '$150-$300', NULL),

-- Young adult gifts
('Кофемашина', 'Автоматична кавомашина для дому або офісу', '$150-$500', NULL),
('Комплект для домашнього кінотеатру', 'Система з якісним звуком та зображенням', '$300-$800', NULL),
('Набір для виготовлення крафтового пива', 'Комплект для домашнього пивоваріння', '$80-$200', NULL),
('Електричний самокат', 'Компактний транспортний засіб для міста', '$300-$700', NULL),
('Набір для йоги преміум-класу', 'Високоякісне спорядження для практики йоги', '$100-$250', NULL),

-- Professional gifts
('Шкіряний портфель', 'Елегантний портфель для ділових зустрічей', '$100-$300', NULL),
('Професійна кавоварка', 'Кавоварка для справжніх цінителів кави', '$200-$500', NULL),
('Графічний планшет', 'Пристрій для дизайнерів та ілюстраторів', '$150-$800', NULL),
('Комплект для запису подкастів', 'Набір для створення якісних аудіозаписів', '$120-$400', NULL),
('Розумний годинник преміум-класу', 'Багатофункціональний годинник з преміальних матеріалів', '$200-$800', NULL),

-- Gender-specific gifts
('Набір для догляду за бородою', 'Комплект для чоловіків із засобами по догляду за бородою', '$40-$100', NULL),
('Жіночий подарунковий набір косметики', 'Набір люксової косметики для жінок', '$70-$200', NULL),
('Набір інструментів преміум-класу', 'Професійні інструменти для домашнього майстра', '$100-$300', NULL),
('Шовкова піжама', 'Розкішна піжама з натурального шовку', '$80-$200', NULL),
('Спортивний годинник із GPS', 'Годинник для тренувань з функцією відстеження маршруту', '$150-$500', NULL);

-- Tag connections for new gifts
-- Children's gifts
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
-- LEGO Constructor (gift_id=16)
(16, (SELECT id FROM tags WHERE name = 'children')),
(16, (SELECT id FROM tags WHERE name = 'unisex')),
(16, (SELECT id FROM tags WHERE name = 'art'));

-- Interactive Toy (gift_id=17)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(17, (SELECT id FROM tags WHERE name = 'children')),
(17, (SELECT id FROM tags WHERE name = 'unisex')),
(17, (SELECT id FROM tags WHERE name = 'technology'));

-- Creativity Kit (gift_id=18)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(18, (SELECT id FROM tags WHERE name = 'children')),
(18, (SELECT id FROM tags WHERE name = 'unisex')),
(18, (SELECT id FROM tags WHERE name = 'art'));

-- Children's Tablet (gift_id=19)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(19, (SELECT id FROM tags WHERE name = 'children')),
(19, (SELECT id FROM tags WHERE name = 'unisex')),
(19, (SELECT id FROM tags WHERE name = 'technology')),
(19, (SELECT id FROM tags WHERE name = 'student'));

-- Educational Board Game (gift_id=20)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(20, (SELECT id FROM tags WHERE name = 'children')),
(20, (SELECT id FROM tags WHERE name = 'unisex')),
(20, (SELECT id FROM tags WHERE name = 'gaming'));

-- Teenager gifts
-- Gaming Headphones (gift_id=21)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(21, (SELECT id FROM tags WHERE name = 'teenagers')),
(21, (SELECT id FROM tags WHERE name = 'unisex')),
(21, (SELECT id FROM tags WHERE name = 'gaming')),
(21, (SELECT id FROM tags WHERE name = 'technology')),
(21, (SELECT id FROM tags WHERE name = 'music'));

-- Teen Backpack (gift_id=22)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(22, (SELECT id FROM tags WHERE name = 'teenagers')),
(22, (SELECT id FROM tags WHERE name = 'unisex')),
(22, (SELECT id FROM tags WHERE name = 'fashion')),
(22, (SELECT id FROM tags WHERE name = 'student'));

-- Teen Smartwatch (gift_id=23)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(23, (SELECT id FROM tags WHERE name = 'teenagers')),
(23, (SELECT id FROM tags WHERE name = 'unisex')),
(23, (SELECT id FROM tags WHERE name = 'technology')),
(23, (SELECT id FROM tags WHERE name = 'fitness'));

-- Science Experiment Kit (gift_id=24)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(24, (SELECT id FROM tags WHERE name = 'teenagers')),
(24, (SELECT id FROM tags WHERE name = 'unisex')),
(24, (SELECT id FROM tags WHERE name = 'student')),
(24, (SELECT id FROM tags WHERE name = 'teacher'));

-- Portable Gaming Console (gift_id=25)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(25, (SELECT id FROM tags WHERE name = 'teenagers')),
(25, (SELECT id FROM tags WHERE name = 'unisex')),
(25, (SELECT id FROM tags WHERE name = 'gaming')),
(25, (SELECT id FROM tags WHERE name = 'technology'));

-- Young adult gifts
-- Coffee Machine (gift_id=26)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(26, (SELECT id FROM tags WHERE name = 'young adults')),
(26, (SELECT id FROM tags WHERE name = 'adults')),
(26, (SELECT id FROM tags WHERE name = 'unisex')),
(26, (SELECT id FROM tags WHERE name = 'cooking'));

-- Home Theater System (gift_id=27)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(27, (SELECT id FROM tags WHERE name = 'young adults')),
(27, (SELECT id FROM tags WHERE name = 'adults')),
(27, (SELECT id FROM tags WHERE name = 'unisex')),
(27, (SELECT id FROM tags WHERE name = 'technology')),
(27, (SELECT id FROM tags WHERE name = 'music'));

-- Craft Beer Kit (gift_id=28)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(28, (SELECT id FROM tags WHERE name = 'young adults')),
(28, (SELECT id FROM tags WHERE name = 'adults')),
(28, (SELECT id FROM tags WHERE name = 'male')),
(28, (SELECT id FROM tags WHERE name = 'cooking'));

-- Electric Scooter (gift_id=29)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(29, (SELECT id FROM tags WHERE name = 'young adults')),
(29, (SELECT id FROM tags WHERE name = 'unisex')),
(29, (SELECT id FROM tags WHERE name = 'technology')),
(29, (SELECT id FROM tags WHERE name = 'travel'));

-- Premium Yoga Set (gift_id=30)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(30, (SELECT id FROM tags WHERE name = 'young adults')),
(30, (SELECT id FROM tags WHERE name = 'adults')),
(30, (SELECT id FROM tags WHERE name = 'female')),
(30, (SELECT id FROM tags WHERE name = 'fitness'));

-- Professional gifts
-- Leather Briefcase (gift_id=31)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(31, (SELECT id FROM tags WHERE name = 'adults')),
(31, (SELECT id FROM tags WHERE name = 'unisex')),
(31, (SELECT id FROM tags WHERE name = 'business')),
(31, (SELECT id FROM tags WHERE name = 'fashion'));

-- Professional Coffee Maker (gift_id=32)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(32, (SELECT id FROM tags WHERE name = 'adults')),
(32, (SELECT id FROM tags WHERE name = 'unisex')),
(32, (SELECT id FROM tags WHERE name = 'cooking')),
(32, (SELECT id FROM tags WHERE name = 'business'));

-- Graphics Tablet (gift_id=33)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(33, (SELECT id FROM tags WHERE name = 'young adults')),
(33, (SELECT id FROM tags WHERE name = 'adults')),
(33, (SELECT id FROM tags WHERE name = 'unisex')),
(33, (SELECT id FROM tags WHERE name = 'technology')),
(33, (SELECT id FROM tags WHERE name = 'art')),
(33, (SELECT id FROM tags WHERE name = 'artist'));

-- Podcast Kit (gift_id=34)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(34, (SELECT id FROM tags WHERE name = 'young adults')),
(34, (SELECT id FROM tags WHERE name = 'adults')),
(34, (SELECT id FROM tags WHERE name = 'unisex')),
(34, (SELECT id FROM tags WHERE name = 'technology')),
(34, (SELECT id FROM tags WHERE name = 'music'));

-- Premium Smartwatch (gift_id=35)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(35, (SELECT id FROM tags WHERE name = 'adults')),
(35, (SELECT id FROM tags WHERE name = 'unisex')),
(35, (SELECT id FROM tags WHERE name = 'technology')),
(35, (SELECT id FROM tags WHERE name = 'business')),
(35, (SELECT id FROM tags WHERE name = 'fitness'));

-- Gender-specific gifts
-- Beard Care Kit (gift_id=36)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(36, (SELECT id FROM tags WHERE name = 'young adults')),
(36, (SELECT id FROM tags WHERE name = 'adults')),
(36, (SELECT id FROM tags WHERE name = 'male')),
(36, (SELECT id FROM tags WHERE name = 'fashion'));

-- Women's Cosmetics Set (gift_id=37)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(37, (SELECT id FROM tags WHERE name = 'young adults')),
(37, (SELECT id FROM tags WHERE name = 'adults')),
(37, (SELECT id FROM tags WHERE name = 'female')),
(37, (SELECT id FROM tags WHERE name = 'fashion'));

-- Premium Tool Set (gift_id=38)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(38, (SELECT id FROM tags WHERE name = 'adults')),
(38, (SELECT id FROM tags WHERE name = 'male')),
(38, (SELECT id FROM tags WHERE name = 'engineer'));

-- Silk Pajamas (gift_id=39)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(39, (SELECT id FROM tags WHERE name = 'adults')),
(39, (SELECT id FROM tags WHERE name = 'female')),
(39, (SELECT id FROM tags WHERE name = 'fashion'));

-- Sports Watch with GPS (gift_id=40)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(40, (SELECT id FROM tags WHERE name = 'young adults')),
(40, (SELECT id FROM tags WHERE name = 'adults')),
(40, (SELECT id FROM tags WHERE name = 'unisex')),
(40, (SELECT id FROM tags WHERE name = 'technology')),
(40, (SELECT id FROM tags WHERE name = 'fitness')),
(40, (SELECT id FROM tags WHERE name = 'sports'));

-- Add specialty gifts for specific professions
INSERT INTO gifts (name, description, price_range, image_url) VALUES
('Стетоскоп преміум-класу', 'Високоякісний медичний інструмент для лікарів', '$150-$300', NULL),
('Набір для програмування Arduino', 'Комплект для створення електронних проєктів', '$60-$150', NULL),
('Професійний мікроскоп', 'Точний інструмент для наукових досліджень', '$200-$800', NULL),
('Набір архітектурних олівців', 'Професійні креслярські інструменти', '$40-$120', NULL),
('Портативна студія звукозапису', 'Комплект для створення музики в будь-якому місці', '$200-$600', NULL);

-- Tag these specialty profession gifts
-- Premium Stethoscope (gift_id=41)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(41, (SELECT id FROM tags WHERE name = 'adults')),
(41, (SELECT id FROM tags WHERE name = 'unisex')),
(41, (SELECT id FROM tags WHERE name = 'doctor'));

-- Arduino Programming Kit (gift_id=42)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(42, (SELECT id FROM tags WHERE name = 'teenagers')),
(42, (SELECT id FROM tags WHERE name = 'young adults')),
(42, (SELECT id FROM tags WHERE name = 'adults')),
(42, (SELECT id FROM tags WHERE name = 'unisex')),
(42, (SELECT id FROM tags WHERE name = 'technology')),
(42, (SELECT id FROM tags WHERE name = 'programmer')),
(42, (SELECT id FROM tags WHERE name = 'engineer'));

-- Professional Microscope (gift_id=43)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(43, (SELECT id FROM tags WHERE name = 'adults')),
(43, (SELECT id FROM tags WHERE name = 'unisex')),
(43, (SELECT id FROM tags WHERE name = 'doctor')),
(43, (SELECT id FROM tags WHERE name = 'teacher'));

-- Architectural Pencil Set (gift_id=44)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(44, (SELECT id FROM tags WHERE name = 'young adults')),
(44, (SELECT id FROM tags WHERE name = 'adults')),
(44, (SELECT id FROM tags WHERE name = 'unisex')),
(44, (SELECT id FROM tags WHERE name = 'art')),
(44, (SELECT id FROM tags WHERE name = 'engineer')),
(44, (SELECT id FROM tags WHERE name = 'artist'));

-- Portable Recording Studio (gift_id=45)
INSERT INTO gift_tags (gift_id, tag_id) VALUES 
(45, (SELECT id FROM tags WHERE name = 'young adults')),
(45, (SELECT id FROM tags WHERE name = 'adults')),
(45, (SELECT id FROM tags WHERE name = 'unisex')),
(45, (SELECT id FROM tags WHERE name = 'music')),
(45, (SELECT id FROM tags WHERE name = 'technology')),
(45, (SELECT id FROM tags WHERE name = 'artist'));


UPDATE gift_tags SET tag_id = (SELECT id FROM tags WHERE name = 'male')
WHERE gift_id = 14 AND tag_id = (SELECT id FROM tags WHERE name = 'unisex');

-- Add more gender-specific gift tags
INSERT INTO gift_tags (gift_id, tag_id) VALUES
(14, (SELECT id FROM tags WHERE name = 'male')),
(6, (SELECT id FROM tags WHERE name = 'female'));


-- Create indexes for performance
CREATE INDEX idx_gifts_name ON gifts(name);
CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_tags_category ON tags(category);
CREATE INDEX idx_gift_tags_gift_id ON gift_tags(gift_id);
CREATE INDEX idx_gift_tags_tag_id ON gift_tags(tag_id);