require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const app = express();

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: 'http://localhost:3000/auth/github/callback'
}, (accessToken, refreshToken, profile, done) => {
  return done(null, { profile, accessToken });
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

app.use(express.json());
app.use(session({
  secret: 'mysecret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
const PORT = process.env.PORT || 3000;
const items = [];
const userPortfolios = new Map();

app.get('/', (req, res) => {
  res.send('Server is running');
});

app.get('/api/test', (req, res) => {
  res.json(items);
});

app.post('/api/test', (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0 || !req.body.name || req.body.name.trim() === '') {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const newItem = {
    name: req.body.name,
    createdAt: new Date()
  };
  items.push(newItem);
  res.json(items);
});

app.get('/api/repos', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const accessToken = req.user.accessToken;
  const response = await fetch('https://api.github.com/user/repos', {
    headers: {
      Authorization: `token ${accessToken}`
    }
  });
  const data = await response.json();
  const portfolioRepos = data.map(repo => ({
    title: repo.name,
    summary: repo.description || 'No description available',
    link: repo.html_url,
    tech: repo.language || 'Not specified',
    lastUpdated: repo.updated_at
  }));
  res.json(portfolioRepos);
});

app.post('/api/portfolio', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = req.user.profile.id;
  userPortfolios.set(userId, req.body);
  res.json({ message: 'Portfolio saved' });
});

app.get('/api/portfolio', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = req.user.profile.id;
  const portfolio = userPortfolios.get(userId);
  if (!portfolio) {
    return res.json({ message: 'No portfolio found' });
  }
  res.json(portfolio);
});

app.get('/api/portfolio/generate', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = req.user.profile.id;
  const portfolio = userPortfolios.get(userId);
  if (!portfolio) {
    return res.json({ message: 'No portfolio found' });
  }
  const username = req.user.profile.username;
  const techSet = new Set();
  portfolio.forEach(project => {
    if (project.tech) {
      techSet.add(project.tech);
    }
  });
  const techSummary = Array.from(techSet).filter(tech => tech !== 'Not specified');
  const portfolioSummary = `${username} is a passionate developer with hands-on experience building real-world applications using ${techSummary.join(', ')}. With ${portfolio.length} completed projects, their work demonstrates strong problem-solving skills, continuous learning, and practical development experience.`;
  res.json({
    owner: username,
    portfolioTitle: `${username}'s Portfolio`,
    projectCount: portfolio.length,
    projects: portfolio,
    techSummary,
    portfolioSummary
  });
});

app.get('/api/portfolio/generate-narrative', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = req.user.profile.id;
  const portfolio = userPortfolios.get(userId);
  if (!portfolio) {
    return res.json({ message: 'No portfolio found' });
  }
  const username = req.user.profile.username;
  const techSet = new Set();
  portfolio.forEach(project => {
    if (project.tech) {
      techSet.add(project.tech);
    }
  });
  const techSummary = Array.from(techSet).filter(tech => tech !== 'Not specified');
  const narrativePrompt = `Write a professional portfolio summary for ${username} who has built ${portfolio.length} projects using ${techSummary.join(', ')}.`;
  const generatedNarrative = `${username} is a passionate developer with hands-on experience building real-world applications using ${techSummary.join(', ')}. With ${portfolio.length} completed projects, their work demonstrates strong problem-solving skills, continuous learning, and practical development experience.`;
  res.json({
    owner: username,
    projectCount: portfolio.length,
    techSummary,
    narrativePrompt,
    generatedNarrative
  });
});

app.get('/api/portfolio/save-from-github', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const accessToken = req.user.accessToken;
  const response = await fetch('https://api.github.com/user/repos', {
    headers: {
      Authorization: `token ${accessToken}`
    }
  });
  const data = await response.json();
  const portfolioRepos = data.map(repo => ({
    title: repo.name,
    summary: repo.description || 'No description available',
    link: repo.html_url,
    tech: repo.language || 'Not specified',
    lastUpdated: repo.updated_at
  }));
  const userId = req.user.profile.id;
  userPortfolios.set(userId, portfolioRepos);
  res.json({ message: 'Portfolio saved', count: portfolioRepos.length });
});

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/' }),
  (req, res) => {
    res.send('Login successful');
  }
);

app.get('/portfolio/view', (req, res) => {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  const userId = req.user.profile.id;
  const portfolio = userPortfolios.get(userId);
  if (!portfolio) {
    return res.send('No portfolio found');
  }
  const username = req.user.profile.username;
  const techSet = new Set();
  portfolio.forEach(project => {
    if (project.tech) {
      techSet.add(project.tech);
    }
  });
  const techSummary = Array.from(techSet).filter(tech => tech !== 'Not specified');
  const generatedNarrative = `${username} is a passionate developer with hands-on experience building real-world applications using ${techSummary.join(', ')}. With ${portfolio.length} completed projects, their work demonstrates strong problem-solving skills, continuous learning, and practical development experience.`;
  // ✅ ADD THIS BLOCK HERE
const recommendations = [];

if (portfolio.length === 0) {
  recommendations.push('Start by saving your GitHub repositories to build your portfolio.');
} else {
  

  const projectsWithNoDescription = portfolio.filter(
    p => 
      !p.summary || 
      p.summary === 'No description' || 
      p.summary === 'No description available' ||
      p.summary.trim() === ''
  ).length;

  if (projectsWithNoDescription > 0) {
    recommendations.push(
      `${projectsWithNoDescription} project(s) have missing descriptions. Add clear descriptions to explain your work.`
    );
  }
  if (techSummary.length < 3) {
    recommendations.push('Expand your tech stack by learning new technologies to show versatility.');
  }

  if (techSummary.includes('JavaScript')) {
    recommendations.push('Consider building a full-stack project to showcase end-to-end development skills.');
  }

  if (portfolio.length < 3) {
    recommendations.push('Consider adding more projects to showcase your skills. Aim for at least 3-5 projects.');
  } else if (portfolio.length < 5) {
    recommendations.push('Good progress! Continue building projects to strengthen your portfolio.');
  } else if (portfolio.length >= 5) {
    recommendations.push('Great portfolio size! Consider highlighting your top 2–3 projects to make your profile more focused.');
  }

  
}
  const projectsList = portfolio.map(project => 
    `<li><strong>${project.title}</strong> - ${project.summary} (${project.tech === 'Not specified' ? 'N/A' : project.tech}) <a href="${project.link}">View</a></li>`
  ).join('');
  res.send(`
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 40px 0;
      background-color: #f8f9fb;
      color: #222;
      line-height: 1.6;
      
    }
    .container {
      background: white;
      padding: 30px 40px;
      border-radius: 12px;
      max-width: 1000px;
      width: 90%;
      margin: 0 auto;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }  
    h1 {
      color: #1f3c88;
      margin-bottom: 20px;
    }
    h2 {
      color: #2c3e50;
      margin-top: 35px;
      margin-bottom: 10px;
      border-bottom: 2px solid #dfe6ee;
      padding-bottom: 5px;
    }
    p {
      margin: 10px 0;
      max-width: 1000px;
    }
    ul {
      padding-left: 25px;
    }
    li {
      margin-bottom: 10px;
    }
    a {
      color: #1f6feb;
      text-decoration: none;
      font-weight: bold;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
<div class="container">
  <h1>${username}'s Portfolio</h1>
  <p>${generatedNarrative}</p>
  <p><strong>Total Projects:</strong> ${portfolio.length}</p>
  <p><strong>Technologies:</strong> ${techSummary.join(', ')}</p>

  <h2>Projects</h2>
  <ul>${projectsList}</ul>

  <h2>Recommendations</h2>
  <ul>
    ${recommendations.map(r => `<li>${r}</li>`).join('')}
  </ul>
</div>
`);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
