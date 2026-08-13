import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { socialAdminApi } from '../utils/api.js';

export default function SocialPostDetails() {
  const { id } = useParams(); const [post, setPost] = useState(null);
  const load = () => socialAdminApi.post(id).then((data) => !data.error && setPost(data));
  useEffect(() => { load(); const timer = setInterval(load, 2000); return () => clearInterval(timer); }, [id]);
  if (!post) return <main className="social-admin"><p>Loading publication…</p></main>;
  return <main className="social-admin social-stack"><header className="social-head"><Link to="/admin/social"><ArrowLeft /></Link><div><small>SOCIAL POST</small><h1>{post.status}</h1></div></header><article className="post-detail"><h2>{post.caption}</h2>{post.link && <a href={post.link}>{post.link}</a>}<small>Created {new Date(post.createdAt).toLocaleString()} by {post.createdBy}</small></article><h2>Platforms</h2>{post.publications.map((publication) => <article className="publication" key={publication._id}><div><strong>{publication.platform}</strong><span>{publication.status}</span></div>{publication.publicationUrl && <a href={publication.publicationUrl} target="_blank" rel="noreferrer">View post <ExternalLink size={15} /></a>}{publication.errorMessage && <p>{publication.errorMessage}</p>}{publication.status === 'FAILED' && <button onClick={() => socialAdminApi.retry(post._id, publication._id).then(load)}><RefreshCw size={16} /> Retry {publication.platform}</button>}</article>)}<h2>Generated Tasks</h2>{post.tasks?.map((task) => <Link className="generated-task" to="/tasks" key={task._id}>{task.status === 'DONE' ? '✓' : '○'} {task.title}<small>Due {new Date(task.dueAt).toLocaleString()}</small></Link>)}{!post.tasks?.length && <p className="social-note">Tasks appear as publications complete.</p>}</main>;
}
