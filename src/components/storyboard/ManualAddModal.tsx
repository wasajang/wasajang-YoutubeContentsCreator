import React, { useState } from 'react';
import { User, MapPin, Sword, X, Plus } from 'lucide-react';
import type { AssetCard, AssetType } from '../../store/projectStore';

interface ManualAddModalProps {
    manualCount: number;
    maxSlots: number;
    onAdd: (card: AssetCard) => void;
    onClose: () => void;
}

const ManualAddModal: React.FC<ManualAddModalProps> = ({ manualCount, maxSlots, onAdd, onClose }) => {
    const [addType, setAddType] = useState<AssetType>('character');
    const [form, setForm] = useState({ name: '', description: '' });

    const handleSubmit = () => {
        if (!form.name.trim() || manualCount >= maxSlots) return;
        onAdd({
            id: `manual-${Date.now()}`,
            name: form.name,
            type: addType,
            description: form.description,
            imageUrl: '',
            seed: Math.floor(Math.random() * 99999),
            status: 'pending',
            source: 'manual',
        });
        setForm({ name: '', description: '' });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="manual-add-modal" onClick={(e) => e.stopPropagation()}>
                <div className="manual-add-modal__header">
                    <h3>수동 카드 추가</h3>
                    <span className="manual-add-modal__count">{manualCount}/{maxSlots}</span>
                    <button className="btn-icon" onClick={onClose} style={{ marginLeft: 'auto' }}><X size={14} /></button>
                </div>
                <div className="manual-add-modal__types">
                    {(['character', 'background', 'item'] as const).map((t) => (
                        <button
                            key={t}
                            className={`manual-add-modal__type-btn ${addType === t ? 'manual-add-modal__type-btn--active' : ''}`}
                            onClick={() => setAddType(t)}
                        >
                            {t === 'character' ? <><User size={12} /> 캐릭터</> : t === 'background' ? <><MapPin size={12} /> 배경</> : <><Sword size={12} /> 아이템</>}
                        </button>
                    ))}
                </div>
                <div className="manual-add-modal__form">
                    <div className="modal__field">
                        <label className="modal__label">이름</label>
                        <input className="modal__input" placeholder="카드 이름을 입력하세요" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="modal__field">
                        <label className="modal__label">프롬프트 설명</label>
                        <textarea className="modal__textarea" placeholder="자세히 묘사해주세요" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <button
                        className="btn-primary"
                        style={{ width: '100%', marginTop: 8 }}
                        onClick={handleSubmit}
                        disabled={!form.name.trim() || manualCount >= maxSlots}
                    >
                        <Plus size={14} /> 덱에 추가 ({manualCount}/{maxSlots})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManualAddModal;
