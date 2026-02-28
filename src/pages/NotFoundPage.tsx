import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Zap } from 'lucide-react';

const NotFoundPage: React.FC = () => {
    return (
        <div className="not-found-page">
            <div className="not-found-page__inner">
                <div className="not-found-page__icon">
                    <Zap size={40} />
                </div>
                <h1 className="not-found-page__code">404</h1>
                <p className="not-found-page__msg">페이지를 찾을 수 없습니다.</p>
                <p className="not-found-page__sub">요청한 페이지가 존재하지 않거나 이동되었습니다.</p>
                <Link to="/" className="btn-primary not-found-page__btn">
                    <Home size={14} /> 홈으로 돌아가기
                </Link>
            </div>
        </div>
    );
};

export default NotFoundPage;
