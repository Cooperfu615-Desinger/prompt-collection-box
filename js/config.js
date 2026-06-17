// ===== Firebase Configuration =====
const firebaseConfig = {
    apiKey: "AIzaSyBqegw9GxFNJe45gRjAPf_Cd8oOy_ioynw",
    authDomain: "prompt-collection-cloud.firebaseapp.com",
    projectId: "prompt-collection-cloud",
    storageBucket: "prompt-collection-cloud.firebasestorage.app",
    messagingSenderId: "221852213987",
    appId: "1:221852213987:web:ced5f261cdd27d43611bd6",
    measurementId: "G-0ET6RM8YXF"
};

// ===== App Configuration =====
const PROMPT_COLLECTION = 'prompts';
const TAG_POOL_COLLECTION = 'tagPool';
const ALLOWED_EMAIL = 'cooperfu.615@gmail.com';

const FIXED_TAG_POOL = {
    '主體': ['單人', '雙人', '三人以上', '其他'],
    '服裝': ['內衣', '泳裝', '巴洛克', '龐克', 'BDSM', '休閒', '運動', '水手服', '制服'],
    '場景': ['廢墟', '咖啡廳', '酒吧', '公園', '臥室', '浴室', '城堡', '巷弄', '街道', '室內', '戶外'],
    '風格': ['攝影大師', '單眼', '手機', '電影感', '2D', '3D', '電影'],
    '光影': ['自然', '過曝', '低光源', '側光']
};

const TAG_CATEGORY_COLORS = {
    '主體': { bg: 'rgba(59, 130, 246, 0.18)', border: 'rgba(59, 130, 246, 0.45)', text: '#60a5fa' },
    '服裝': { bg: 'rgba(236, 72, 153, 0.18)', border: 'rgba(236, 72, 153, 0.45)', text: '#f472b6' },
    '場景': { bg: 'rgba(34, 197, 94, 0.18)', border: 'rgba(34, 197, 94, 0.45)', text: '#4ade80' },
    '風格': { bg: 'rgba(251, 191, 36, 0.18)', border: 'rgba(251, 191, 36, 0.45)', text: '#fbbf24' },
    '光影': { bg: 'rgba(168, 85, 247, 0.18)', border: 'rgba(168, 85, 247, 0.45)', text: '#c084fc' }
};

const IMPORT_TAG_SYNONYMS = {
    '一位': '單人',
    '1 位': '單人',
    'one woman': '單人',
    'single woman': '單人',
    '比基尼': '泳裝',
    'bikini': '泳裝'
};

const LOCAL_STORAGE_KEY = 'prompt-collection-box';
const API_KEY_STORAGE = 'gemini-api-key';
const XAI_API_KEY_STORAGE = 'xai-api-key';
const IMAGE_MODEL_STORAGE = 'gemini-image-model';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const IMAGE_MODEL_OPTIONS = [
    {
        value: 'gemini-3.1-flash-image-preview',
        label: 'Gemini 3.1 Flash Image Preview',
        provider: 'google'
    },
    {
        value: 'gemini-3-pro-image-preview',
        label: 'Gemini 3 Pro Image Preview',
        provider: 'google'
    },
    {
        value: 'gemini-2.5-flash-image',
        label: 'Gemini 2.5 Flash Image',
        provider: 'google'
    },
    {
        value: 'grok-imagine-image',
        label: 'xAI Grok Imagine Standard',
        provider: 'xai'
    },
    {
        value: 'grok-imagine-image-quality',
        label: 'xAI Grok Imagine Quality',
        provider: 'xai'
    }
];
const GEMINI_IMAGE_MODELS = IMAGE_MODEL_OPTIONS
    .filter(option => option.provider === 'google')
    .map(option => option.value);
const IMAGE_MODEL_VALUES = IMAGE_MODEL_OPTIONS.map(option => option.value);
const DEFAULT_GEMINI_IMAGE_MODEL = IMAGE_MODEL_OPTIONS[0].value;
const MAX_VARIANTS = 5;
