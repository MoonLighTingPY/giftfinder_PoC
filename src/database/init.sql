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

-- Gifts table (Added budget_min, budget_max)
CREATE TABLE IF NOT EXISTS gifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_en VARCHAR(100), -- English name for image search
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  price_range VARCHAR(50),
  budget_min DECIMAL(10, 2) DEFAULT 0.00,
  budget_max DECIMAL(10, 2) DEFAULT 9999.99,
  image_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tags table (Added 'occasion' category)
CREATE TABLE IF NOT EXISTS tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  category ENUM('age', 'gender', 'interest', 'profession', 'occasion') NOT NULL -- Added 'occasion'
);

-- Insert sample data
-- Insert sample tags (Added Occasion Tags)
INSERT INTO tags (name, category) VALUES
-- Age groups
('children', 'age'), ('teenagers', 'age'), ('young adults', 'age'), ('adults', 'age'), ('seniors', 'age'),
-- Gender
('male', 'gender'), ('female', 'gender'), ('unisex', 'gender'),
-- Interests
('reading', 'interest'), ('gaming', 'interest'), ('cooking', 'interest'), ('sports', 'interest'), ('music', 'interest'),
('art', 'interest'), ('technology', 'interest'), ('travel', 'interest'), ('fashion', 'interest'), ('fitness', 'interest'),
('gardening', 'interest'), ('photography', 'interest'),
-- Professions
('student', 'profession'), ('teacher', 'profession'), ('programmer', 'profession'), ('doctor', 'profession'),
('artist', 'profession'), ('engineer', 'profession'), ('business', 'profession'),
-- Occasions (New)
('birthday', 'occasion'), ('christmas', 'occasion'), ('anniversary', 'occasion'), ('valentines', 'occasion'),
('graduation', 'occasion'), ('thank you', 'occasion'), ('any', 'occasion'); -- 'any' for general gifts

-- Insert sample gifts (Updated with budget_min, budget_max)
-- Note: Price ranges are approximate guides. Adjust min/max as needed.
INSERT INTO gifts (name, name_en, ai_generated, description, price_range, budget_min, budget_max, image_url) VALUES
('Бездротові навушники', 'Wireless Headphones', FALSE, 'Високоякісні шумопоглинаючі бездротові навушники', '$100-$300', 100.00, 300.00, NULL),
('Електронна книга', 'E-Reader', FALSE, 'Пристрій для читання з екраном, що нагадує папір', '$80-$250', 80.00, 250.00, NULL),
('Розумний годинник', 'Smart Watch', FALSE, 'Смарт-годинник для фітнесу та здоров\'я', '$150-$400', 150.00, 400.00, NULL),
('Ігрова консоль', 'Gaming Console', FALSE, 'Сучасна ігрова консоль з контролерами', '$300-$600', 300.00, 600.00, NULL),
('Набір кухонних ножів', 'Kitchen Knife Set', FALSE, 'Професійний набір кухонних ножів', '$100-$300', 100.00, 300.00, NULL),
('Килимок для йоги', 'Yoga Mat', FALSE, 'Екологічний нековзкий килимок для йоги', '$20-$50', 20.00, 50.00, NULL),
('Цифрова камера', 'Digital Camera', FALSE, 'Компактна бездзеркальна цифрова камера', '$400-$1000', 400.00, 1000.00, NULL),
('Набір для художника', 'Art Supply Set', FALSE, 'Професійний набір для малювання в дерев\'яному кейсі', '$50-$150', 50.00, 150.00, NULL),
('Туристичний рюкзак', 'Travel Backpack', FALSE, 'Ергономічний легкий рюкзак для подорожей', '$50-$150', 50.00, 150.00, NULL),
('Набір для програмування роботів', 'Arduino Programming Kit', FALSE, 'Освітній набір для вивчення програмування', '$80-$200', 80.00, 200.00, NULL),
('Механічна клавіатура', 'Mechanical Keyboard', FALSE, 'RGB механічна клавіатура для ігор та програмування', '$80-$200', 80.00, 200.00, NULL),
('Набір садових інструментів', 'Garden Tool Set', FALSE, 'Повний набір садових інструментів та аксесуарів', '$30-$100', 30.00, 100.00, NULL),
('Портативна Bluetooth колонка', 'Portable Bluetooth Speaker', FALSE, 'Водонепроникна портативна Bluetooth колонка', '$50-$150', 50.00, 150.00, NULL),
('Стильний годинник', 'Stylish Watch', FALSE, 'Наручний годинник класичного дизайну для будь-якого випадку', '$100-$500', 100.00, 500.00, NULL),
('Колекція кулінарних книг', 'Cookbook Collection', FALSE, 'Набір популярних кулінарних книг', '$40-$120', 40.00, 120.00, NULL),
('Конструктор LEGO', 'LEGO Set', FALSE, 'Набір для розвитку креативності та моторики', '$30-$100', 30.00, 100.00, NULL),
('Інтерактивна іграшка', 'Interactive Toy', FALSE, 'Розумна іграшка з освітніми функціями', '$40-$80', 40.00, 80.00, NULL),
('Набір для творчості', 'Creativity Kit', FALSE, 'Комплект для малювання та рукоділля', '$20-$60', 20.00, 60.00, NULL),
('Дитячий планшет', 'Children\'s Tablet', FALSE, 'Спеціальний планшет для навчання дітей', '$80-$150', 80.00, 150.00, NULL),
('Розвиваюча настільна гра', 'Educational Board Game', FALSE, 'Гра для розвитку логіки та мислення', '$15-$40', 15.00, 40.00, NULL),
('Бездротові навушники для гейминга', 'Gaming Headphones', FALSE, 'Ігрові навушники з мікрофоном та RGB підсвіткою', '$60-$150', 60.00, 150.00, NULL),
('Рюкзак для підлітків', 'Teen Backpack', FALSE, 'Стильний та місткий рюкзак для школи', '$30-$80', 30.00, 80.00, NULL),
('Смарт-годинник для підлітків', 'Teen Smartwatch', FALSE, 'Водостійкий годинник з трекером активності', '$50-$120', 50.00, 120.00, NULL),
('Набір для наукових експериментів', 'Science Experiment Kit', FALSE, 'Комплект для проведення простих наукових дослідів', '$40-$90', 40.00, 90.00, NULL),
('Портативна ігрова консоль', 'Portable Gaming Console', FALSE, 'Компактна консоль для ігор у дорозі', '$150-$300', 150.00, 300.00, NULL),
('Кофемашина', 'Coffee Machine', FALSE, 'Автоматична кавомашина для дому або офісу', '$150-$500', 150.00, 500.00, NULL),
('Комплект для домашнього кінотеатру', 'Home Theater System', FALSE, 'Система з якісним звуком та зображенням', '$300-$800', 300.00, 800.00, NULL),
('Набір для виготовлення крафтового пива', 'Craft Beer Kit', FALSE, 'Комплект для домашнього пивоваріння', '$80-$200', 80.00, 200.00, NULL),
('Електричний самокат', 'Electric Scooter', FALSE, 'Компактний транспортний засіб для міста', '$300-$700', 300.00, 700.00, NULL),
('Набір для йоги преміум-класу', 'Premium Yoga Kit', FALSE, 'Високоякісне спорядження для практики йоги', '$100-$250', 100.00, 250.00, NULL),
('Шкіряний портфель', 'Leather Briefcase', FALSE, 'Елегантний портфель для ділових зустрічей', '$100-$300', 100.00, 300.00, NULL),
('Професійна кавоварка', 'Professional Coffee Maker', FALSE, 'Кавоварка для справжніх цінителів кави', '$200-$500', 200.00, 500.00, NULL),
('Графічний планшет', 'Graphics Tablet', FALSE, 'Пристрій для дизайнерів та ілюстраторів', '$150-$800', 150.00, 800.00, NULL),
('Комплект для запису подкастів', 'Podcast Recording Kit', FALSE, 'Набір для створення якісних аудіозаписів', '$120-$400', 120.00, 400.00, NULL),
('Розумний годинник преміум-класу', 'Premium Smartwatch', FALSE, 'Багатофункціональний годинник з преміальних матеріалів', '$200-$800', 200.00, 800.00, NULL),
('Набір для догляду за бородою', 'Beard Care Kit', FALSE, 'Комплект для чоловіків із засобами по догляду за бородою', '$40-$100', 40.00, 100.00, NULL),
('Жіночий подарунковий набір косметики', 'Women\'s Cosmetics Gift Set', FALSE, 'Набір люксової косметики для жінок', '$70-$200', 70.00, 200.00, NULL),
('Набір інструментів преміум-класу', 'Premium Tool Set', FALSE, 'Професійні інструменти для домашнього майстра', '$100-$300', 100.00, 300.00, NULL),
('Шовкова піжама', 'Silk Pajamas', FALSE, 'Розкішна піжама з натурального шовку', '$80-$200', 80.00, 200.00, NULL),
('Спортивний годинник із GPS', 'Sports Watch with GPS', FALSE, 'Годинник для тренувань з функцією відстеження маршруту', '$150-$500', 150.00, 500.00, NULL),
('Стетоскоп преміум-класу', 'Premium Stethoscope', FALSE, 'Високоякісний медичний інструмент для лікарів', '$150-$300', 150.00, 300.00, NULL),
('Набір для програмування Arduino', 'Arduino Programming Kit', FALSE, 'Комплект для створення електронних проєктів', '$60-$150', 60.00, 150.00, NULL),
('Професійний мікроскоп', 'Professional Microscope', FALSE, 'Точний інструмент для наукових досліджень', '$200-$800', 200.00, 800.00, NULL),
('Набір архітектурних олівців', 'Architectural Pencil Set', FALSE, 'Професійні креслярські інструменти', '$40-$120', 40.00, 120.00, NULL),
('Портативна студія звукозапису', 'Portable Recording Studio', FALSE, 'Комплект для створення музики в будь-якому місці', '$200-$600', 200.00, 600.00, NULL);


-- Create indexes for performance
CREATE INDEX idx_gifts_name ON gifts(name);
CREATE INDEX idx_gifts_name_en ON gifts(name_en);
CREATE INDEX idx_gifts_budget_min ON gifts(budget_min); -- Index for budget
CREATE INDEX idx_gifts_budget_max ON gifts(budget_max); -- Index for budget

-- Create sample users
INSERT INTO users (username, email, password_hash) VALUES
('test', 'test@example.com', '$2b$10$QOW9yAiHKsNHDt65DTYFYuK.QIbFn1jM8kD7Q/4CtplTcQM00.e6C'); -- Password: password123