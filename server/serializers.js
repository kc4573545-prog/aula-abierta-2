// Convierte filas de PostgreSQL al formato que espera el frontend (camelCase, fechas en ms).
const ms = (d) => (d ? new Date(d).getTime() : null);

function article(r) {
  const a = {
    id: r.id,
    title: r.title,
    summary: r.summary,
    subject: r.subject,
    grade: r.grade,
    readTime: r.read_time,
    status: r.status,
    coverImage: r.cover_image,
    coverAlt: r.cover_alt,
    author: r.author,
    role: r.role,
    views: r.views,
    content: r.content,
    tags: Array.isArray(r.tags) ? r.tags : [],
    allowComments: r.allow_comments,
    featured: r.featured,
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
  };
  if (r.previous_status) a.previousStatus = r.previous_status;
  if (r.trashed_at) a.trashedAt = ms(r.trashed_at);
  return a;
}

function comment(r) {
  return {
    id: r.id,
    articleId: r.article_id,
    authorName: r.author_name,
    authorType: r.author_type,
    authorBadge: r.author_badge,
    schoolInfo: r.school_info,
    content: r.content,
    status: r.status,
    isSpamAlert: r.is_spam_alert,
    teacherReply: r.teacher_reply,
    createdAt: ms(r.created_at),
  };
}

// Versión pública del comentario (sin datos internos de moderación)
function publicComment(r) {
  const c = comment(r);
  delete c.isSpamAlert;
  return c;
}

function media(r) {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    url: r.url,
    sizeKB: r.size_kb,
    dimensions: r.dimensions,
    altText: r.alt_text,
    associatedArticle: r.associated_article,
    createdAt: ms(r.created_at),
  };
}

function profile(r) {
  return {
    key: 'teacherProfile',
    name: r.name,
    title: r.title,
    role: r.role,
    specialty: r.specialty,
    school: r.school,
    yearsExperience: r.years_experience,
    bio: r.bio,
    photoUrl: r.photo_url,
    updatedAt: ms(r.updated_at),
  };
}

module.exports = { article, comment, publicComment, media, profile, ms };
