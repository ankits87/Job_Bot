from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def score_match(resume_text: str, jd_text: str) -> float:
    """Return cosine similarity (0.0–1.0) between resume and job description."""
    if not resume_text.strip() or not jd_text.strip():
        return 0.0
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
    try:
        tfidf = vectorizer.fit_transform([resume_text, jd_text])
        score = float(cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0])
        return round(score, 4)
    except ValueError:
        return 0.0
