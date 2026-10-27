/**
 * EventService - 景點與活動服務 (路線 A: 真實景點預覽版)
 * 未來可將此處的假資料替換為介接 TDX 或台北市政府 Open Data
 */

class EventService {
  async getAllEvents() {
    // 模擬 API 延遲
    await new Promise(resolve => setTimeout(resolve, 500));

    return [
      {
        id: 'evt_001',
        title: '🎬 西門紅樓文創市集',
        description: '百年紅樓與文創的結合，週末限定市集，充滿在地青年的創意設計與特色手作。',
        year: '週末限定',
        significance: '台北西區最重要的文創聚落與歷史建築，見證了西門町的繁華與轉型。',
        lat: 25.0422,
        lng: 121.5069,
        tags: ['art'],
        image: 'https://images.unsplash.com/photo-1552993873-0aa1fcdd4c13?w=800&q=80'
      },
      {
        id: 'evt_002',
        title: '🎨 華山1914文化創意園區',
        description: '舊酒廠改建的藝文展演空間，匯集各類展覽、獨立電影、特色咖啡廳與大片草地。',
        year: '全天開放',
        significance: '見證台北工業遺產轉型為藝文重鎮的指標性地標，極具歷史保存價值。',
        lat: 25.0441,
        lng: 121.5294,
        tags: ['art', 'music'],
        image: 'https://images.unsplash.com/photo-1543085601-098e945c572a?w=800&q=80'
      },
      {
        id: 'evt_003',
        title: '🍜 寧夏夜市',
        description: '台北最受歡迎的傳統夜市之一，以多樣的古早味小吃與規劃完善的步道聞名。',
        year: '17:00 - 01:00',
        significance: '台北市米其林必比登推薦小吃最密集的夜市，完美展現台灣飲食文化。',
        lat: 25.0563,
        lng: 121.5154,
        tags: ['food'],
        image: 'https://images.unsplash.com/photo-1548674465-c3f25d97f26d?w=800&q=80'
      },
      {
        id: 'evt_004',
        title: '🎵 台北流行音樂中心',
        description: '結合流行音樂與未來感建築的新地標，常舉辦大型演唱會與音樂特展。',
        year: '依展演時間',
        significance: '專為台灣流行音樂產業打造的國際級展演中心，建築外觀極具未來科技感。',
        lat: 25.0526,
        lng: 121.5978,
        tags: ['music'],
        image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80'
      }
    ];
  }
}

export default new EventService();