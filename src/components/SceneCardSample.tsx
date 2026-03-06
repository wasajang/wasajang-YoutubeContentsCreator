import React from 'react';
import './SceneCardSample.css';

// Using simple SVG icons to avoid missing lucide-react dependencies
const DownloadIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
);

const RefreshIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </svg>
);

const FileTextIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
);

const SceneCardSample: React.FC = () => {
    return (
        <div className="page-wrapper">
            <h1 className="page-title">UI Design Sample: Scene Generation Card</h1>

            <div className="scene-card-sample">
                <div className="scene-card-content">
                    {/* Left: Media Area */}
                    <div className="scene-card-left">
                        <div className="scene-card-badge">SCENE 1 (00:00 - 00:06)</div>
                        <img
                            src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
                            alt="Generated scene"
                            className="scene-card-image"
                        />
                        <button className="scene-card-download-btn">
                            <DownloadIcon />
                            다운로드
                        </button>
                    </div>

                    {/* Right: Content & Controls Area */}
                    <div className="scene-card-right">
                        <div className="scene-card-header">
                            <div className="scene-label">SCENE 1</div>
                            <div className="status-badge">
                                <div className="status-dot"></div>
                                완성
                            </div>
                        </div>

                        <div className="script-container">
                            <div className="script-label">
                                <FileTextIcon />
                                SCRIPT
                            </div>
                            <div className="script-text">
                                "이란이 무너지면, 중동의 지도가 통째로 다시 그려집니다. 유가는 배럴당 150달러를 뚫고, 여러분이 매달 넣는 기름값과 장바구니 물가, 대출 이자가 동시에 치솟습니다."
                            </div>
                        </div>

                        <div className="action-bar">
                            <button className="action-btn-secondary">
                                <FileTextIcon />
                                대본 수정
                            </button>
                            <button className="action-btn">
                                <RefreshIcon />
                                다시 생성
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SceneCardSample;
