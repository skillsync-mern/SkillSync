// Fills the database with realistic demo data. Run: npm run seed
// Wipes users, companies, jobs, applications and notifications first.
const mongoose = require('mongoose');
const config = require('./config');
const User = require('./models/User');
const Company = require('./models/Company');
const Job = require('./models/Job');
const Application = require('./models/Application');
const Notification = require('./models/Notification');
const { matchSkills } = require('./utils/skills');

const DEMO_PASSWORD = 'Password123!';
const days = (n) => new Date(Date.now() + n * 86400000);

const companies = [
  { key: 'northwind', name: 'Northwind Labs', industry: 'Software', size: '51-200', location: 'Hyderabad', status: 'approved', website: 'https://northwind.example.com', description: 'We build analytics tooling for logistics teams. Small squads, real ownership, weekly releases.', owner: ['Priya Nair', 'priya@northwind.example'], recruiters: [['Arjun Rao', 'arjun@northwind.example']] },
  { key: 'greenleaf', name: 'Greenleaf Health', industry: 'Healthtech', size: '201-1000', location: 'Bengaluru', status: 'approved', website: 'https://greenleaf.example.com', description: 'Digital care for chronic conditions. ML-assisted triage and a clinician-first product.', owner: ['Meera Iyer', 'meera@greenleaf.example'], recruiters: [['Karan Shah', 'karan@greenleaf.example']] },
  { key: 'paperkite', name: 'Paperkite Studio', industry: 'Design', size: '11-50', location: 'Remote', status: 'pending', description: 'A design and web studio that has just joined SkillSync.', owner: ['Sana Qureshi', 'sana@paperkite.example'], recruiters: [] },
];

const jobs = [
  ['northwind', 'Full-stack engineer (MERN)', 'Own features end to end across a React front end and Node/Express services backed by MongoDB. You will ship weekly, review code and talk to customers.', 'Hyderabad', 'full-time', 'hybrid', ['React', 'Node.js', 'MongoDB', 'Express', 'REST'], 2, 1200000, 2000000],
  ['northwind', 'Frontend developer', 'Build dashboards that make route data readable. You care about accessibility, performance and well-structured components.', 'Remote', 'full-time', 'remote', ['React', 'JavaScript', 'CSS', 'Accessibility'], 1, 800000, 1400000],
  ['northwind', 'Machine learning engineer', 'Train and ship demand-forecasting models and serve them behind a Python API. Collaborate closely with the data team.', 'Hyderabad', 'full-time', 'onsite', ['Python', 'Machine Learning', 'scikit-learn', 'SQL', 'Docker'], 3, 1800000, 3000000],
  ['northwind', 'Backend intern', 'Six-month internship on the API team. You will write endpoints, tests and documentation with a mentor.', 'Hyderabad', 'internship', 'onsite', ['Node.js', 'MongoDB', 'Git'], 0, 240000, 360000],
  ['greenleaf', 'Data scientist, clinical triage', 'Develop models that prioritise patient messages for clinicians. Work with clinicians to validate every release.', 'Bengaluru', 'full-time', 'hybrid', ['Python', 'Machine Learning', 'NLP', 'SQL', 'Statistics'], 3, 2000000, 3400000],
  ['greenleaf', 'DevOps engineer', 'Run our Kubernetes platform and improve deployment safety. On-call is shared and well supported.', 'Bengaluru', 'full-time', 'hybrid', ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Linux'], 3, 1800000, 3000000],
  ['greenleaf', 'Mobile developer (React Native)', 'Build the patient app used by thousands of people each day. Offline-first design and strong testing habits matter here.', 'Remote', 'contract', 'remote', ['React Native', 'JavaScript', 'TypeScript', 'REST'], 2, 1500000, 2400000],
  ['greenleaf', 'QA automation engineer', 'Design and maintain automated tests for web and mobile releases. Own quality gates in the pipeline.', 'Bengaluru', 'full-time', 'onsite', ['Testing', 'Cypress', 'JavaScript', 'CI/CD'], 2, 900000, 1500000],
  ['greenleaf', 'Product designer', 'Shape care flows for patients and clinicians. Run research, prototype quickly, and work with engineers daily.', 'Bengaluru', 'full-time', 'hybrid', ['Figma', 'UX Research', 'Prototyping'], 3, 1600000, 2600000],
  ['paperkite', 'Web designer', 'Design marketing sites and brand systems for small clients. Hand off clean specs to our developers.', 'Remote', 'part-time', 'remote', ['Figma', 'CSS', 'Branding'], 1, 500000, 900000],
];

const seekers = [
  { name: 'Naga Vishnu', email: 'naga@skillsync.dev', headline: 'AI and ML student who builds MERN apps', location: 'Guntur', skills: ['React', 'Node.js', 'MongoDB', 'Express', 'Python', 'Machine Learning', 'Git'], experienceYears: 1, bio: 'Final-year B.Tech student building applied AI and web projects.' },
  { name: 'Ishaan Verma', email: 'ishaan@skillsync.dev', headline: 'Frontend developer', location: 'Hyderabad', skills: ['React', 'JavaScript', 'CSS', 'Accessibility', 'TypeScript'], experienceYears: 3, bio: 'I like turning messy interfaces into calm ones.' },
  { name: 'Ananya Rao', email: 'ananya@skillsync.dev', headline: 'Data scientist', location: 'Bengaluru', skills: ['Python', 'Machine Learning', 'SQL', 'scikit-learn', 'NLP', 'Statistics'], experienceYears: 4, bio: 'Healthcare analytics, forecasting and NLP.' },
  { name: 'Rohit Menon', email: 'rohit@skillsync.dev', headline: 'DevOps engineer', location: 'Bengaluru', skills: ['Docker', 'Kubernetes', 'AWS', 'Linux', 'CI/CD'], experienceYears: 5, bio: 'Reliability and boring deploys.' },
  { name: 'Divya Krishnan', email: 'divya@skillsync.dev', headline: 'Product designer', location: 'Remote', skills: ['Figma', 'UX Research', 'Prototyping', 'Branding'], experienceYears: 4, bio: 'Designer who writes her own microcopy.' },
  { name: 'Sameer Khan', email: 'sameer@skillsync.dev', headline: 'Backend developer', location: 'Hyderabad', skills: ['Node.js', 'MongoDB', 'Express', 'Docker', 'REST', 'Git'], experienceYears: 2, bio: 'APIs, databases and tests.' },
];

// [seeker index, job index, final status, cover letter]
const applications = [
  [0, 0, 'shortlisted', 'I have built several MERN projects and would love to grow on a product team.'],
  [0, 3, 'applied', 'I am looking for an internship where I can ship real backend work.'],
  [1, 0, 'reviewing', 'Strong on React; keen to widen my back-end skills.'],
  [1, 1, 'interview', 'Accessibility and performance are what I care about most.'],
  [5, 0, 'applied', 'Two years of Node and Mongo in production.'],
  [5, 3, 'rejected', 'Applying for the intern role while I finish a certification.'],
  [2, 2, 'offered', 'Forecasting is my daily work and I enjoy shipping models.'],
  [2, 4, 'hired', 'Clinical NLP is the work I most want to do.'],
  [3, 5, 'interview', 'Five years running Kubernetes in production.'],
  [4, 8, 'reviewing', 'I would love to design for clinicians and patients.'],
  [0, 2, 'applied', 'Keen to apply my ML coursework.'],
];

async function seed() {
  await Promise.all([User, Company, Job, Application, Notification].map((M) => M.deleteMany({})));

  const admin = await User.create({ name: 'SkillSync Admin', email: config.adminEmail, password: config.adminPassword, role: 'admin' });

  const companyDocs = {};
  const staff = {};
  for (const c of companies) {
    const owner = await User.create({ name: c.owner[0], email: c.owner[1], password: DEMO_PASSWORD, role: 'company' });
    const company = await Company.create({ name: c.name, industry: c.industry, size: c.size, location: c.location, website: c.website, description: c.description, status: c.status, owner: owner._id });
    owner.company = company._id;
    await owner.save();
    companyDocs[c.key] = company;
    staff[c.key] = [owner];
    for (const [name, email] of c.recruiters) {
      staff[c.key].push(await User.create({ name, email, password: DEMO_PASSWORD, role: 'recruiter', company: company._id }));
    }
  }

  const seekerDocs = [];
  for (const s of seekers) seekerDocs.push(await User.create({ ...s, password: DEMO_PASSWORD, role: 'jobseeker' }));

  const jobDocs = [];
  for (const [key, title, description, location, type, workMode, skills, experienceMin, salaryMin, salaryMax] of jobs) {
    const poster = staff[key][staff[key].length - 1]; // recruiter if there is one, else the owner
    jobDocs.push(await Job.create({ title, description, location, type, workMode, skills, experienceMin, salaryMin, salaryMax, company: companyDocs[key]._id, postedBy: poster._id, deadline: days(45), status: 'open' }));
  }
  // one closed job to show job states
  await Job.create({ title: 'Technical writer', description: 'Write developer documentation and API guides for our logistics platform.', location: 'Remote', type: 'contract', workMode: 'remote', skills: ['Writing', 'Markdown', 'APIs'], company: companyDocs.northwind._id, postedBy: staff.northwind[0]._id, status: 'closed' });

  const path = ['applied', 'reviewing', 'shortlisted', 'interview', 'offered', 'hired'];
  for (const [si, ji, status, coverLetter] of applications) {
    const seeker = seekerDocs[si];
    const job = jobDocs[ji];
    const recruiter = staff[Object.keys(companyDocs).find((k) => String(companyDocs[k]._id) === String(job.company))].slice(-1)[0];
    const history = [{ status: 'applied', by: seeker._id, at: days(-10) }];
    const upTo = status === 'rejected' ? 1 : path.indexOf(status);
    for (let i = 1; i <= upTo; i++) history.push({ status: path[i], by: recruiter._id, at: days(-10 + i * 2) });
    if (status === 'rejected') history.push({ status: 'rejected', by: recruiter._id, at: days(-4), note: 'We are moving forward with candidates closer to the role.' });
    await Application.create({
      job: job._id, applicant: seeker._id, company: job.company, coverLetter, status,
      matchScore: matchSkills(job.skills, seeker.skills).score, history,
      interviewAt: status === 'interview' ? days(3) : undefined,
      notes: status === 'shortlisted' ? [{ author: recruiter._id, text: 'Good portfolio. Ask about testing habits.' }] : [],
    });
  }

  await Notification.insertMany([
    { user: admin._id, type: 'company_registered', title: 'New company awaiting approval', message: 'Paperkite Studio has registered and needs review.', link: '/admin/companies' },
    { user: seekerDocs[0]._id, type: 'application_status', title: 'You have been shortlisted', message: 'Full-stack engineer (MERN) at Northwind Labs.', link: '/dashboard' },
    { user: staff.northwind[0]._id, type: 'application_received', title: 'New application for Full-stack engineer (MERN)', message: 'Sameer Khan applied (100% skill match).', link: '/manage/applicants' },
  ]);

  return { admin, companies: Object.keys(companyDocs).length, jobs: jobDocs.length + 1, seekers: seekerDocs.length };
}

module.exports = { seed, DEMO_PASSWORD };

if (require.main === module) {
  if (config.env === 'production' && !process.argv.includes('--force')) {
    console.error('Refusing to wipe a production database. Re-run with --force if you mean it.');
    process.exit(1);
  }
  mongoose
    .connect(config.mongoUri)
    .then(seed)
    .then((r) => {
      console.log(`Seeded ${mongoose.connection.name}: ${r.companies} companies, ${r.jobs} jobs, ${r.seekers} job seekers.\n`);
      console.log('Sign-in accounts');
      console.log(`  admin       ${config.adminEmail} / ${config.adminPassword}`);
      console.log(`  company     priya@northwind.example / ${DEMO_PASSWORD}   (approved)`);
      console.log(`  company     sana@paperkite.example / ${DEMO_PASSWORD}    (pending approval)`);
      console.log(`  recruiter   arjun@northwind.example / ${DEMO_PASSWORD}`);
      console.log(`  job seeker  naga@skillsync.dev / ${DEMO_PASSWORD}`);
      return mongoose.disconnect();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
