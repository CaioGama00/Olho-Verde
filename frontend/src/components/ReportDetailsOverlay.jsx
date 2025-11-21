import React, { useState, useEffect, useRef } from 'react';
import { FaThumbsUp, FaThumbsDown, FaTimes, FaMapMarkerAlt, FaWater, FaTrashAlt, FaTree, FaRoad, FaImage } from 'react-icons/fa';
import { CgMoreVertical } from "react-icons/cg";
import reportService from '../services/reportService';
import instagramIcon from '../assets/instagram.svg';
import { getStatusLabel } from '../utils/reportStatus';
import './ReportDetailsOverlay.css';

const BASE_COLORS = {
    Alagamento: '#1e90ff',
    'Foco de lixo': '#e67e22',
    'Árvore caída': '#27ae60',
    'Bueiro entupido': '#8e44ad',
    'Buraco na via': '#c0392b',
    default: '#3498db',
};

const problemIcons = {
    'Alagamento': <FaWater />,
    'Foco de lixo': <FaTrashAlt />,
    'Árvore caída': <FaTree />,
    'Bueiro entupido': <CgMoreVertical />,
    'Buraco na via': <FaRoad />,
};

const ReportDetailsOverlay = ({ report, currentUser, onClose }) => {
    const [address, setAddress] = useState('Carregando endereço...');
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [detailedReport, setDetailedReport] = useState(null);

    // Local state for immediate UI updates (Optimistic UI)
    const [localUpvotes, setLocalUpvotes] = useState(0);
    const [localDownvotes, setLocalDownvotes] = useState(0);
    const [currentUserVote, setCurrentUserVote] = useState(null);
    const [isVoting, setIsVoting] = useState(false);

    const initialVoteState = useRef({
        vote: null,
        upvotes: 0,
        downvotes: 0,
    });

    useEffect(() => {
        if (!report) return;

        setDetailedReport(null);
        setLocalUpvotes(report.upvotes || 0);
        setLocalDownvotes(report.downvotes || 0);
        setCurrentUserVote(report.user_vote || null);

        initialVoteState.current = {
            vote: report.user_vote || null,
            upvotes: report.upvotes || 0,
            downvotes: report.downvotes || 0,
        };

        // Fetch address
        if (report.position) {
            const { lat, lng } = report.position;
            fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
                headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'Olho-Verde' },
            })
                .then((res) => res.json())
                .then((data) => {
                    const label =
                        data?.address?.road ||
                        data?.address?.pedestrian ||
                        data?.address?.suburb ||
                        data?.display_name ||
                        'Endereço não encontrado';
                    setAddress(label);
                })
                .catch(() => setAddress('Endereço indisponível'));
        }

        let cancelled = false;

        reportService.getReportDetails(report.id)
            .then((response) => {
                const payload = response?.data || {};
                if (cancelled) return;
                setDetailedReport(payload);
                setComments(payload.comments || []);
                setLocalUpvotes(payload.upvotes || 0);
                setLocalDownvotes(payload.downvotes || 0);
                setCurrentUserVote(payload.user_vote || null);
                initialVoteState.current = {
                    vote: payload.user_vote || null,
                    upvotes: payload.upvotes || 0,
                    downvotes: payload.downvotes || 0,
                };
            })
            .catch((error) => {
                console.error('Erro ao buscar detalhes do report:', error);
            });

        return () => {
            cancelled = true;
        };
    }, [report]);

    if (!report) return null;

    const activeReport = detailedReport || report;

    const handleLocalVote = (voteType) => {
        if (!currentUser || isVoting) return;

        let newVote = currentUserVote;
        let upvotes = localUpvotes;
        let downvotes = localDownvotes;

        const isCurrentlyUpvoted = newVote === 'up';
        const isCurrentlyDownvoted = newVote === 'down';

        if (voteType === 'up') {
            if (isCurrentlyUpvoted) {
                newVote = null;
                upvotes--;
            } else if (isCurrentlyDownvoted) {
                newVote = 'up';
                upvotes++;
                downvotes--;
            } else {
                newVote = 'up';
                upvotes++;
            }
        } else if (voteType === 'down') {
            if (isCurrentlyDownvoted) {
                newVote = null;
                downvotes--;
            } else if (isCurrentlyUpvoted) {
                newVote = 'down';
                downvotes++;
                upvotes--;
            } else {
                newVote = 'down';
                downvotes++;
            }
        }

        setCurrentUserVote(newVote);
        setLocalUpvotes(upvotes);
        setLocalDownvotes(downvotes);

        const voteToSend = newVote === 'up' ? 'up' : newVote === 'down' ? 'down' : null;

        setIsVoting(true);
        reportService.vote(report.id, voteToSend)
            .then((response) => {
                const payload = response?.data || {};
                // Sync with backend response if needed, but usually optimistic is fine
            })
            .catch(error => {
                console.error("Failed to persist vote:", error);
                alert('Houve um erro ao salvar seu voto.');
                // Revert
                setLocalUpvotes(initialVoteState.current.upvotes);
                setLocalDownvotes(initialVoteState.current.downvotes);
                setCurrentUserVote(initialVoteState.current.vote);
            })
            .finally(() => setIsVoting(false));
    };

    const handleAddComment = () => {
        if (!currentUser || !newComment.trim()) return;
        const content = newComment.trim();
        const authorName = currentUser?.user?.user_metadata?.name || currentUser?.user?.email || currentUser?.email || 'Você';
        const authorEmail = currentUser?.user?.email || currentUser?.email || null;
        const optimistic = {
            id: `temp-${Date.now()}`,
            author_name: authorName,
            author_email: authorEmail,
            content,
            created_at: new Date().toISOString(),
            pending: true,
        };
        setComments((prev) => [optimistic, ...prev]);
        setNewComment('');

        reportService.addComment(report.id, content)
            .then((response) => {
                const saved = response?.data;
                setComments((prev) => {
                    const filtered = prev.filter((c) => !c.pending);
                    return [saved, ...filtered];
                });
            })
            .catch((error) => {
                console.error('Erro ao salvar comentário:', error);
                alert('Não foi possível salvar o comentário.');
                setComments((prev) => prev.filter((c) => !c.pending));
                setNewComment(content);
            });
    };

    const statusLabel = getStatusLabel(activeReport.status);
    const problemColor = BASE_COLORS[activeReport.problem] || BASE_COLORS.default;
    const ProblemIcon = problemIcons[activeReport.problem] || <FaMapMarkerAlt />;

    return (
        <div className="report-overlay-container">
            <div className="report-overlay-backdrop" onClick={onClose} />
            <div className="report-overlay-panel">
                <button className="close-button" onClick={onClose} aria-label="Fechar">
                    <FaTimes />
                </button>

                <div className="report-header">
                    <div className="report-icon-large" style={{ backgroundColor: problemColor }}>
                        {ProblemIcon}
                    </div>
                    <div className="report-title-section">
                        <span className="report-id">Denúncia #{activeReport.id}</span>
                        <h2>{activeReport.problem}</h2>
                        <span className={`status-badge status-${activeReport.status || 'nova'}`}>
                            {statusLabel}
                        </span>
                    </div>
                </div>

                <div className="report-body">
                    {activeReport.image_url && (
                        <div className="evidence-card">
                            <img src={activeReport.image_url} alt="Evidência da denúncia" />
                        </div>
                    )}

                    <div className="info-section description-block">
                        <span className="label description-label">Descrição</span>
                        <p className="value description-text">
                            {activeReport.description || 'Sem descrição fornecida.'}
                        </p>
                    </div>

                    <div className="info-section">
                        <div className="info-row">
                            <span className="label">Localização</span>
                            <p className="value">{address}</p>
                            <small className="coords">
                                {activeReport.position?.lat?.toFixed(5)}, {activeReport.position?.lng?.toFixed(5)}
                            </small>
                        </div>

                        <div className="info-row">
                            <span className="label">Data</span>
                            <p className="value">
                                {new Date(activeReport.created_at).toLocaleDateString('pt-BR', {
                                    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                })}
                            </p>
                        </div>
                    </div>

                    <div className="vote-section">
                        <h3>Avalie esta denúncia</h3>
                        <div className="vote-buttons">
                            <button
                                className={`vote-btn up ${currentUserVote === 'up' ? 'active' : ''}`}
                                onClick={() => handleLocalVote('up')}
                                disabled={!currentUser || isVoting}
                            >
                                <FaThumbsUp /> {localUpvotes}
                            </button>
                            <button
                                className={`vote-btn down ${currentUserVote === 'down' ? 'active' : ''}`}
                                onClick={() => handleLocalVote('down')}
                                disabled={!currentUser || isVoting}
                            >
                                <FaThumbsDown /> {localDownvotes}
                            </button>
                        </div>
                        {!currentUser && <p className="login-hint">Faça login para votar.</p>}
                    </div>

                    <div className="share-section">
                        <h3>Compartilhar</h3>
                        <div className="share-buttons">
                            <button className="instagram-button">
                                <img src={instagramIcon} alt="Instagram" className="instagram-icon" />
                                <span>Instagram</span>
                            </button>
                        </div>
                    </div>

                    <div className="comments-section">
                        <h3>Comentários ({comments.length})</h3>

                        {currentUser ? (
                            <div className="comment-input-area">
                                <textarea
                                    placeholder="Escreva um comentário..."
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    rows={2}
                                />
                                <button
                                    onClick={handleAddComment}
                                    disabled={!newComment.trim()}
                                >
                                    Enviar
                                </button>
                            </div>
                        ) : (
                            <p className="login-hint">Faça login para comentar.</p>
                        )}

                        <div className="comments-list">
                            {comments.length === 0 ? (
                                <p className="no-comments">Nenhum comentário ainda.</p>
                            ) : (
                                comments.map(c => (
                                    <div key={c.id} className="comment-card">
                                        <div className="comment-header">
                                            <span className="author">{c.author_name || 'Usuário'}</span>
                                            <span className="date">
                                                {new Date(c.created_at || c.createdAt).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                        <p>{c.content || c.text}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportDetailsOverlay;
