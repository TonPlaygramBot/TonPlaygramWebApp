

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(express.json());
app.use('/api/mining', miningRoutes);
app.use('/api/tasks', tasksRoutes);


app.use(express.static(webappPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(webappPath, 'index.html'));
});

app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// Support client-side routing by returning index.html for other paths
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).end();
  res.sendFile(path.join(webappPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;

