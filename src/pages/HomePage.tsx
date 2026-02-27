import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, FileText, ArrowRight, Star } from 'lucide-react';
import { genreFilters, heroTemplates, templateCards } from '../data/mockData';
import { useProjectStore } from '../store/projectStore';

const HomePage: React.FC = () => {
    const [activeFilter, setActiveFilter] = useState('MOST POPULAR');
    const navigate = useNavigate();
    const startNewProject = useProjectStore((state) => state.startNewProject);

    const filteredTemplates =
        activeFilter === 'MOST POPULAR'
            ? templateCards
            : templateCards.filter((t) => t.genre === activeFilter);

    const handleNewProject = (title?: string) => {
        startNewProject(title || 'Untitled Project');
        navigate('/project/idea');
    };

    // Generate placeholder colors for template cards
    const getCardColor = (index: number) => {
        const colors = [
            'linear-gradient(135deg, #1a3a2e 0%, #0f2027 100%)',
            'linear-gradient(135deg, #2d1b3d 0%, #1a1a2e 100%)',
            'linear-gradient(135deg, #3a2518 0%, #1a0f0a 100%)',
            'linear-gradient(135deg, #0f2027 0%, #1a1a2e 100%)',
            'linear-gradient(135deg, #1e3a1e 0%, #0a1f0a 100%)',
            'linear-gradient(135deg, #3a1e3a 0%, #1a0a1a 100%)',
            'linear-gradient(135deg, #1e2a3a 0%, #0a1520 100%)',
            'linear-gradient(135deg, #3a2d1e 0%, #1f170a 100%)',
            'linear-gradient(135deg, #2e1e3a 0%, #150a20 100%)',
            'linear-gradient(135deg, #1a3a3a 0%, #0a2020 100%)',
            'linear-gradient(135deg, #3a3a1e 0%, #20200a 100%)',
            'linear-gradient(135deg, #2a1a3a 0%, #130a1f 100%)',
        ];
        return colors[index % colors.length];
    };

    return (
        <div className="page-container">
            <div className="page-content">
                {/* Hero */}
                <div className="home-hero">
                    <h1 className="home-hero__title">
                        What story will you tell today?
                    </h1>
                </div>

                {/* Filter Tabs */}
                <div className="filter-tabs">
                    {genreFilters.map((filter) => (
                        <button
                            key={filter}
                            className={`filter-tab ${activeFilter === filter ? 'active' : ''}`}
                            onClick={() => setActiveFilter(filter)}
                        >
                            {filter}
                        </button>
                    ))}
                </div>

                {/* Hero Cards */}
                <div className="hero-cards">
                    {heroTemplates.map((template) => (
                        <div
                            key={template.id}
                            className="hero-card"
                            onClick={() => handleNewProject(template.title)}
                        >
                            <div
                                className="hero-card__bg"
                                style={{
                                    backgroundImage: template.imageUrl ? `url(${template.imageUrl})` : 'none',
                                    background: template.imageUrl ? undefined : template.gradient,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}
                            />
                            <div className="hero-card__content">
                                <h3 className="hero-card__title">{template.title}</h3>
                                <p className="hero-card__desc">{template.description}</p>
                                <button className="btn-primary">
                                    Generate <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Generate Options + Template Grid */}
                <div className="generate-section">
                    <h2 className="generate-section__title">Generate</h2>
                    <div className="home-main">
                        {/* Left: Generate Options */}
                        <div className="generate-options">
                            <div
                                className="generate-option"
                                onClick={() => handleNewProject()}
                            >
                                <div className="generate-option__icon">
                                    <Sparkles size={20} />
                                </div>
                                <div className="generate-option__text">
                                    <h4>Generate from idea or script</h4>
                                    <p>Create a new project from an idea or script</p>
                                </div>
                            </div>
                            <div
                                className="generate-option"
                                onClick={() => handleNewProject()}
                            >
                                <div className="generate-option__icon">
                                    <FileText size={20} />
                                </div>
                                <div className="generate-option__text">
                                    <h4>Blank project</h4>
                                    <p>Start with an empty project</p>
                                </div>
                            </div>
                            <div className="generate-option">
                                <div className="generate-option__icon">
                                    <Star size={20} />
                                </div>
                                <div className="generate-option__text">
                                    <h4>Create preset</h4>
                                    <p>Save your settings as a template</p>
                                </div>
                            </div>
                        </div>

                        {/* Right: Template Grid */}
                        <div className="template-grid">
                            {filteredTemplates.map((template, index) => (
                                <div
                                    key={template.id}
                                    className="template-card"
                                    onClick={() => handleNewProject(template.title)}
                                >
                                    {template.imageUrl ? (
                                        <img
                                            src={template.imageUrl}
                                            className="template-card__img"
                                            alt={template.title}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.background = getCardColor(index);
                                                (e.target as HTMLImageElement).src = ''; // Hide broken image icon
                                            }}
                                        />
                                    ) : (
                                        <div
                                            className="template-card__img"
                                            style={{ background: getCardColor(index) }}
                                        />
                                    )}
                                    <div className="template-card__overlay">
                                        <span className="template-card__title">{template.title}</span>
                                    </div>
                                    <div className="template-card__arrow">
                                        <ArrowRight size={12} color="#fff" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
