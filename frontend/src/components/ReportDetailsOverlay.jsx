import React, { useState, useEffect, useRef } from 'react';
import { FaThumbsUp, FaThumbsDown, FaTimes, FaMapMarkerAlt, FaWater, FaTrashAlt, FaTree, FaRoad } from 'react-icons/fa';
import { CgMoreVertical } from "react-icons/cg";
import reportService from '../services/reportService';
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

const getStoredComments = (reportId) => {
    try {
        const raw = localStorage.getItem(`report-comments-${reportId}`);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const saveComments = (reportId, comments) => {
    try {
        localStorage.setItem(`report-comments-${reportId}`, JSON.stringify(comments));
    } catch {
        // ignore
    }
};

const ReportDetailsOverlay = ({ report, currentUser, onClose }) => {
    const [address, setAddress] = useState('Carregando endereço...');
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');

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
        if (report) {
            setLocalUpvotes(report.upvotes || 0);
            setLocalDownvotes(report.downvotes || 0);
            setCurrentUserVote(report.user_vote || null);
            setComments(getStoredComments(report.id));

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
        }
    }, [report]);

    if (!report) return null;

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
        const entry = {
            id: Date.now(),
            author: currentUser?.user?.user_metadata?.name || currentUser?.email || 'Você',
            text: newComment.trim(),
            createdAt: new Date().toISOString(),
        };
        const updated = [entry, ...comments].slice(0, 30);
        setComments(updated);
        saveComments(report.id, updated);
        setNewComment('');
    };

    const statusLabel = getStatusLabel(report.status);
    const problemColor = BASE_COLORS[report.problem] || BASE_COLORS.default;
    const ProblemIcon = problemIcons[report.problem] || <FaMapMarkerAlt />;

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
                        <span className="report-id">Denúncia #{report.id}</span>
                        <h2>{report.problem}</h2>
                        <span className={`status-badge status-${report.status || 'nova'}`}>
                            {statusLabel}
                        </span>
                    </div>
                </div>

                <div className="report-body">
                    <div className="info-section">
                        <div className="info-row">
                            <span className="label">Localização</span>
                            <p className="value">{address}</p>
                            <small className="coords">
                                {report.position?.lat?.toFixed(5)}, {report.position?.lng?.toFixed(5)}
                            </small>
                        </div>

                        <div className="info-row">
                            <span className="label">Data</span>
                            <p className="value">
                                {new Date(report.created_at).toLocaleDateString('pt-BR', {
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
                                            <span className="author">{c.author}</span>
                                            <span className="date">
                                                {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                        <p>{c.text}</p>
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
