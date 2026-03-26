-- ============================================================
-- SEED DATA — New_Vacancy (NV)
-- ============================================================

-- Sample Govt Jobs
INSERT INTO public.jobs (title, organization, category, department, location, state, qualification, vacancies, salary_range, age_limit, apply_url, notification_url, last_date, is_featured, tags) VALUES
('Staff Selection Commission CGL 2024', 'Staff Selection Commission', 'govt', 'Central Government', 'All India', NULL, 'Graduate', 17727, '₹25,500 – ₹1,51,100', '18–32 years', 'https://ssc.nic.in', 'https://ssc.nic.in/notifications/cgl2024.pdf', '2025-03-31', TRUE, ARRAY['ssc', 'central-govt', 'graduate']),
('UPSC Civil Services 2024', 'Union Public Service Commission', 'govt', 'IAS/IPS/IFS', 'All India', NULL, 'Graduate (Any Stream)', 1056, '₹56,100 – ₹2,50,000', '21–32 years', 'https://upsc.gov.in', 'https://upsc.gov.in/civil-services-2024.pdf', '2025-02-20', TRUE, ARRAY['upsc', 'ias', 'ips', 'central-govt']),
('Railway RRB NTPC 2024', 'Railway Recruitment Board', 'govt', 'Indian Railways', 'All India', NULL, '12th Pass / Graduate', 11558, '₹19,900 – ₹35,400', '18–33 years', 'https://indianrailways.gov.in', NULL, '2025-04-15', TRUE, ARRAY['railway', 'rrb', 'ntpc']),
('UP Police Constable 2024', 'Uttar Pradesh Police', 'govt', 'UP Police', 'Uttar Pradesh', 'UP', '12th Pass', 60244, '₹21,700 – ₹69,100', '18–22 years', 'https://uppbpb.gov.in', NULL, '2025-03-10', FALSE, ARRAY['police', 'up', 'state-govt']),
('IBPS PO 2024', 'Institute of Banking Personnel Selection', 'govt', 'Banking', 'All India', NULL, 'Graduate', 4455, '₹23,700 – ₹42,020', '20–30 years', 'https://ibps.in', NULL, '2025-05-01', TRUE, ARRAY['banking', 'ibps', 'po']);

-- Sample Private Jobs
INSERT INTO public.jobs (title, organization, category, department, location, qualification, vacancies, salary_range, apply_url, is_featured, tags) VALUES
('Software Engineer – React', 'Tata Consultancy Services', 'private', 'IT / Software', 'Bengaluru / Remote', 'B.Tech / BCA / MCA', 500, '₹3.5–8 LPA', 'https://tcs.com/careers', TRUE, ARRAY['it', 'react', 'software', 'tcs']),
('Data Analyst', 'Infosys', 'private', 'Analytics', 'Hyderabad', 'B.Tech / B.Sc (Stats/Maths)', 200, '₹4–9 LPA', 'https://infosys.com/careers', FALSE, ARRAY['data', 'analytics', 'infosys']),
('Full Stack Developer', 'Wipro', 'private', 'IT Services', 'Pune / Chennai', 'B.Tech CS/IT', 350, '₹5–12 LPA', 'https://wipro.com/careers', TRUE, ARRAY['fullstack', 'node', 'react', 'wipro']),
('HR Executive', 'HCL Technologies', 'private', 'Human Resources', 'Noida', 'MBA HR / PGDM', 80, '₹3–5 LPA', 'https://hcltech.com/careers', FALSE, ARRAY['hr', 'mba', 'hcl']),
('DevOps Engineer', 'Tech Mahindra', 'private', 'Cloud / Infra', 'Remote', 'B.Tech + AWS/GCP Certification', 150, '₹6–15 LPA', 'https://techmahindra.com/careers', TRUE, ARRAY['devops', 'cloud', 'aws', 'techmahindra']);

-- Sample News
INSERT INTO public.news (title, summary, source_name, source_url, category, is_featured) VALUES
('SSC CGL 2024 Notification Released: 17,727 Vacancies Open', 'Staff Selection Commission has officially released the CGL 2024 notification with a record number of vacancies across Group B and C posts in central government departments.', 'SSC Official', 'https://ssc.nic.in', 'govt', TRUE),
('UPSC 2025 Calendar Released: Key Dates for IAS, IFS, CDS Exams', 'UPSC has published its annual exam calendar for 2025. Civil Services Prelims scheduled for May 2025. Candidates are advised to start preparation immediately.', 'UPSC Official', 'https://upsc.gov.in', 'govt', TRUE),
('Google Launches Gemini 2.0 Flash: Fastest AI Model Yet', 'Google DeepMind releases Gemini 2.0 Flash with 1M context window, native tool use, and multimodal output capabilities. Available in Google AI Studio.', 'TechCrunch', 'https://techcrunch.com', 'tech', TRUE),
('India''s IT Sector to Add 3.5 Lakh Jobs in 2025: NASSCOM Report', 'NASSCOM''s annual IT industry report projects significant hiring across AI, cloud, and cybersecurity domains. Freshers with upskilled profiles are in high demand.', 'NASSCOM', 'https://nasscom.in', 'tech', FALSE),
('New Education Policy: UGC Updates Eligibility for Teaching Jobs', 'University Grants Commission has revised the NET qualification criteria and minimum qualification requirements for assistant professor positions effective 2025.', 'UGC India', 'https://ugc.ac.in', 'education', FALSE);

-- Sample Affiliates
INSERT INTO public.affiliates (name, description, banner_url, redirect_url, category, position, placement) VALUES
('Adda247 – Govt Exam Prep', 'India''s #1 platform for SSC, Banking, Railway exam preparation. Get 40% off on annual plans.', 'https://placehold.co/728x90/FF6B35/white?text=Adda247+Govt+Exam+Prep', 'https://adda247.com', 'exam-prep', 1, 'hero'),
('Testbook Pro', 'Practice 10,000+ mock tests for UPSC, SSC, RRB. Trusted by 2Cr+ students.', 'https://placehold.co/300x250/1A73E8/white?text=Testbook+Pro', 'https://testbook.com', 'exam-prep', 2, 'sidebar'),
('Udemy – IT Courses', 'Top-rated courses in React, Python, AWS, Data Science. Starting at ₹455.', 'https://placehold.co/300x250/A435F0/white?text=Udemy+IT+Courses', 'https://udemy.com', 'courses', 3, 'sidebar'),
('Drishti IAS – UPSC Books', 'Best-selling UPSC study material: GS books, Current Affairs, NCERT compilations.', 'https://placehold.co/728x90/2D6A4F/white?text=Drishti+IAS+Books', 'https://drishtiias.com', 'books', 4, 'inline'),
('LinkedIn Premium – 1 Month Free', 'Get noticed by top recruiters. Apply to jobs 3x faster with InMail credits.', 'https://placehold.co/300x250/0A66C2/white?text=LinkedIn+Premium', 'https://linkedin.com/premium', 'tools', 5, 'sidebar');
