/**
 * Plain-language explanations of each blood test parameter, written for a
 * competitive male distance-running squad reading their own numbers. Each
 * entry covers what the marker actually measures and why a distance
 * runner specifically should care about it, grounded in the sports-
 * medicine literature cited under `references`. Where the literature
 * doesn't speak to distance running specifically, that's noted rather than
 * overstated.
 *
 * This is educational context, not a diagnosis - a persistently abnormal
 * value should always go through the team doctor, not just this app.
 */
export interface ParameterInfo {
  /** What the number physically represents. */
  whatItMeasures: string;
  /** Why a distance runner should care - the sports-science angle. */
  athleteRelevance: string;
  references: string[];
}

export const PARAMETER_INFO: Record<string, ParameterInfo> = {
  "フェリチン(Ferritin) (※フェリチン精密)": {
    whatItMeasures:
      "体内に貯蔵されている鉄（貯蔵鉄）の量を反映する指標。肝臓・脾臓・骨髄などに蓄えられた鉄の量に比例して血中濃度が変動するため、鉄欠乏の中でも最も早期に低下するマーカーとして使われる。",
    athleteRelevance:
      "長距離ランナーは、①着地の衝撃で足裏の毛細血管を通る赤血球が壊れる「フットストライク溶血」、②発汗・尿・消化管からの微小な鉄損失、③高強度運動後に上昇する炎症性ホルモン「ヘプシジン」が腸からの鉄吸収を一時的に妨げること、という複数の経路で鉄欠乏に陥りやすい。IOC/AIS（国際オリンピック委員会・オーストラリア国立スポーツ研究所）の指針では、アスリートの鉄欠乏を3段階で捉える：Stage1は貯蔵鉄減少（フェリチン概ね35ng/mL未満、Hbは正常）、Stage2は鉄欠乏性赤血球造血（フェリチン20ng/mL未満かつTSAT16%未満）、Stage3は鉄欠乏性貧血（フェリチン12ng/mL未満かつHb低下）。フェリチンが低い状態はHbが下がる前から持久的パフォーマンスや有酸素性トレーニングへの適応を妨げることが報告されており、「まだ貧血になっていないから大丈夫」とは言えない点が実務上重要。特に女性・成長期・高い走行距離の選手でリスクが高い。",
    references: [
      "Sim M, et al. Iron considerations for the athlete: a narrative review. Eur J Appl Physiol. 2019.",
      "Peeling P, et al. Iron Deficiency in Athletes. Curr Sports Med Rep. 2017.",
      "Sim M, et al. Australian Institute of Sport (AIS) 鉄欠乏に関するコンセンサスステートメント.",
    ],
  },
  "Hb（ヘモグロビン量）": {
    whatItMeasures:
      "赤血球内で酸素を運ぶタンパク質（ヘモグロビン）の血中濃度。全身への酸素運搬能力を直接反映する、持久系競技では最も基本的な指標のひとつ。",
    athleteRelevance:
      "Hbが低い（貧血）と最大酸素摂取量（VO2max）や同じペースでの心拍数・主観的運動強度に悪影響が出ることが古くから知られている。WHOの成人男性における貧血の重症度分類は、軽度11.0〜12.9g/dL、中等度8.0〜10.9g/dL、重度8.0g/dL未満（男女共通）。一方でトレーニングされた持久系アスリートは、血漿量の増加（トレーニングによる循環血液量の適応）によって見かけ上Hb濃度が薄まる「スポーツ性貧血（希釈性偽貧血）」を示すことがあり、これは病的な貧血とは区別する必要がある。フェリチンやMCV・網赤血球数など他の指標と合わせて、真の鉄欠乏性貧血か、トレーニング適応による生理的な血液希釈かを見極めることが重要。",
    references: [
      "WHO. Haemoglobin concentrations for the diagnosis of anaemia and assessment of severity. 2011.",
      "Schumacher YO, et al. Hematological indices and iron status in athletes. Int J Sports Med. 2002.",
      "Eichner ER. Sports anemia, iron supplements, and blood doping. Med Sci Sports Exerc. 1992.",
    ],
  },
  "ヘマトクリット値（Hematocrit)": {
    whatItMeasures:
      "血液全体に占める赤血球の体積割合（%）。Hbと並んで酸素運搬能力の目安になると同時に、血液の粘性・濃縮度（脱水の有無）にも影響される。",
    athleteRelevance:
      "急な低下はトレーニングに伴う血漿量増加（希釈）や出血・溶血を、急な上昇は脱水による血液濃縮や、高地トレーニング・高強度トレーニングに対する赤血球産生の亢進を示唆する。自転車競技などではヘマトクリット50%が不正な赤血球増多（血液ドーピング）を疑う目安として使われてきた経緯があるが、これは薬物検査の文脈の話であり、通常のトレーニング管理では脱水・鉄欠乏・オーバートレーニングの兆候を見る指標として使うのが実務的。",
    references: [
      "Schumacher YO, et al. Hematological indices and iron status in athletes. Int J Sports Med. 2002.",
      "Sanchis-Gomar F, et al. Physiological hematological changes in response to endurance exercise. Sports Med. 2018.",
    ],
  },
  "Fe（血清鉄）": {
    whatItMeasures:
      "血液中を循環している（トランスフェリンに結合した状態の）鉄の量。貯蔵鉄（フェリチン）と違い、日内変動や直近の食事の影響を強く受けるため単独での評価は難しい。",
    athleteRelevance:
      "血清鉄は変動が大きいため、フェリチン・TSAT・TIBCと組み合わせて総合的に鉄動態を評価するのが基本。持久系アスリートでは運動直後に一時的に低下することが報告されており、採血のタイミング（安静時・空腹時が望ましい）を揃えることが数値の比較には重要。単独の低値だけで鉄欠乏と判断せず、フェリチンやTSATと合わせて解釈する。",
    references: [
      "Peeling P, et al. Iron Deficiency in Athletes. Curr Sports Med Rep. 2017.",
      "Sim M, et al. Iron considerations for the athlete: a narrative review. Eur J Appl Physiol. 2019.",
    ],
  },
  "UIBC(不飽和鉄結合能)": {
    whatItMeasures:
      "トランスフェリン（鉄を運ぶタンパク質）のうち、まだ鉄と結合していない「空き容量」の量。TIBC（総鉄結合能）から血清鉄を引いた値にほぼ相当する。",
    athleteRelevance:
      "鉄欠乏が進むと、体は運べる鉄を少しでも多く確保しようとトランスフェリンの産生を増やすため、UIBC・TIBCは上昇し、逆にTSAT（飽和度）は低下する、という組み合わせのパターンが鉄欠乏の典型像。単独で見るより、TIBC・TSAT・フェリチンとセットで鉄動態の全体像を捉える指標として使う。",
    references: ["Sim M, et al. Iron considerations for the athlete: a narrative review. Eur J Appl Physiol. 2019."],
  },
  "TIBC(総鉄結合能)": {
    whatItMeasures:
      "血中のトランスフェリンが結合できる鉄の総量（現在結合している分＋空き容量の合計）。トランスフェリンの量そのものを反映する。",
    athleteRelevance:
      "鉄欠乏が進行するとTIBCは上昇する（体が鉄を運ぶ能力を増やそうとする代償反応）。一方、炎症や感染、慢性疾患があるとTIBCは低下することがあり、フェリチンだけでは判断しにくい「鉄欠乏か炎症による見かけ上のフェリチン上昇か」を見分ける補助になる。持久系選手では激しいトレーニング後に炎症性サイトカインが一時的に上昇するため、体調不良や高強度合宿の直後の採血は解釈に注意が必要。",
    references: ["Sim M, et al. Iron considerations for the athlete: a narrative review. Eur J Appl Physiol. 2019."],
  },
  "TSAT(トランスフェリン飽和度）": {
    whatItMeasures:
      "トランスフェリンのうち実際に鉄が結合している割合（％）。血清鉄をTIBCで割って算出される、鉄が実際に利用可能な状態にあるかを示す指標。",
    athleteRelevance:
      "IOC/AISの鉄欠乏ステージングでは、フェリチン20ng/mL未満かつTSAT16%未満を「鉄欠乏性赤血球造血（Stage2）」の目安としており、フェリチンとセットで見ることで「貯蔵鉄は減っているが、まだ骨髄に届く鉄は足りているか」を判断できる。TSATが低いまま放置すると、赤血球産生（造血）に必要な鉄そのものが不足し、貧血（Hb低下）に進行するリスクが高まる。",
    references: [
      "Sim M, et al. Iron considerations for the athlete: a narrative review. Eur J Appl Physiol. 2019.",
      "Peeling P, et al. Iron Deficiency in Athletes. Curr Sports Med Rep. 2017.",
    ],
  },
  "MCV（平均赤血球容積）": {
    whatItMeasures:
      "赤血球1個あたりの平均的な大きさ（体積）。赤血球が小さい（小球性）か、大きい（大球性）かを表す。",
    athleteRelevance:
      "鉄欠乏性貧血が進行すると、材料である鉄が不足するため赤血球は小さく作られる（小球性貧血、MCV低下）。逆にビタミンB12・葉酸の不足では赤血球が大きくなる（大球性貧血、MCV上昇）。Hbやフェリチンの変化と合わせて見ることで、貧血の「原因」を推定する手がかりになる（鉄欠乏か、それ以外の栄養欠乏かなど）。",
    references: ["Eichner ER. Sports anemia, iron supplements, and blood doping. Med Sci Sports Exerc. 1992."],
  },
  "MCH（平均赤血球血色素量）": {
    whatItMeasures: "赤血球1個あたりに含まれるヘモグロビンの平均量。MCVと同様、貧血のタイプを分類するために使う。",
    athleteRelevance:
      "MCVと並行して低下していれば、鉄欠乏性貧血に典型的な「小球性低色素性貧血」のパターンと一致する。単独の異常よりも、Hb・MCV・フェリチンと合わせたパターンで解釈することが実務上重要。",
    references: ["Eichner ER. Sports anemia, iron supplements, and blood doping. Med Sci Sports Exerc. 1992."],
  },
  "MCHC（平均赤血球血色素濃度）": {
    whatItMeasures: "赤血球の体積あたりのヘモグロビン濃度。赤血球の「色の濃さ」を数値化したもの。",
    athleteRelevance:
      "鉄欠乏性貧血ではMCHCも低下する傾向があるが、MCV・MCHに比べると鉄欠乏の初期には変化しにくく、進行してから低下することが多い。単独より他の赤血球指標と組み合わせて評価する。",
    references: ["Eichner ER. Sports anemia, iron supplements, and blood doping. Med Sci Sports Exerc. 1992."],
  },
  網赤血球数: {
    whatItMeasures:
      "骨髄から出たばかりの、まだ成熟しきっていない若い赤血球の割合・数。骨髄がどれだけ活発に赤血球を作っているか（造血の勢い）を反映する。",
    athleteRelevance:
      "高地トレーニングや「living high, training low」の効果判定で、赤血球産生（造血）が実際に高まっているかを見るマーカーとして使われる。高地滞在後7〜10日ほどでエリスロポエチン（EPO）とともに網赤血球が増加し、これが赤血球量増加・持久力向上の裏付けとなる。逆に、貧血があるのに網赤血球が増えていない場合は、骨髄の反応が乏しい（鉄などの材料不足、または骨髄機能低下）ことを示唆する。",
    references: [
      "Nadarajan V, et al. The utility of immature reticulocyte fraction as an indicator of erythropoietic response to altitude training in elite cyclists. Int J Lab Hematol. 2010.",
      "Gore CJ, et al. The athlete's hematological response to hypoxia: a meta-analysis. Am J Hematol. 2018.",
    ],
  },
  "CK（クレアチンキナーゼ）": {
    whatItMeasures:
      "骨格筋（や心筋）の細胞内にある酵素。筋線維が損傷すると血中に漏れ出すため、筋肉のダメージ度合いを反映する代表的なマーカー。",
    athleteRelevance:
      "持久系トレーニング、特に坂道・スピード練習・レース後には筋損傷によりCKが上昇するのが正常な反応で、数百〜数千U/Lまで上がっても病的とは限らない（マラソン後の平均的な上昇は数百〜千数百U/L程度と報告されている）。ただし、CKが正常上限の5倍程度を大きく超えて高値が続く場合は筋損傷が大きく回復が追いついていないサインであり、トレーニング負荷の調整を検討すべき目安になる。CK 5,000U/L超は臨床的に運動誘発性横紋筋融解症の診断の目安とされ、褐色尿・強い筋肉痛・腫脹を伴う場合は医療機関の受診が必要。日々のCK推移をモニタリングすることで、回復が追いついているか（オーバートレーニングの兆候がないか）を客観的に把握できる。",
    references: [
      "Brancaccio P, et al. Biochemical markers of muscular damage. Clin Chem Lab Med. 2010.",
      "Tietze DC, Borchers J. Exertional rhabdomyolysis in the athlete: a clinical review. Curr Sports Med Rep. 2014.",
      "Kim J, et al. Vigorous eccentric exercise, muscle damage and CK response in athletes.",
    ],
  },
  "BUN（尿素窒素）": {
    whatItMeasures: "タンパク質代謝の最終産物である尿素の血中濃度。腎機能に加え、タンパク質摂取量・分解量の影響を受ける。",
    athleteRelevance:
      "高強度・高負荷なトレーニング期や、脱水、高タンパク食、筋分解が進んでいる状態（オーバートレーニング気味の時期など）でBUNは上昇しやすい。クレアチニンと同時に評価し、BUN/クレアチニン比が高い場合は脱水や消化管出血、逆にタンパク摂取不足では低値になることもある。持久系選手では長時間走後に一過性に上昇することが報告されており、単発の高値よりもトレーニング期を通じた推移で疲労蓄積の目安として使うのが実用的。",
    references: [
      "Mercer KG, et al. Kidney injury risk during prolonged endurance running. J Appl Physiol. 2025.",
      "Lippi G, et al. Comparison of changes in biochemical markers for skeletal muscle, hepatic and renal function after long-distance running. 2016.",
    ],
  },
  "コルチゾール（Cortisol）": {
    whatItMeasures:
      "副腎から分泌される代表的なストレスホルモン。血糖・脂質代謝、炎症抑制、覚醒リズムなど幅広く関わり、朝に高く夜に低い日内変動を持つ。",
    athleteRelevance:
      "コルチゾールは「異化（分解）」を促すホルモンで、筋タンパク質合成を促すテストステロンとは逆の働きをする。テストステロン／コルチゾール比（T/C比）は、オーバートレーニング症候群のモニタリング指標として研究されており、この比がベースラインから30%以上低下すると、慢性的な過負荷・回復不足のサインとされる。ただし採血時刻（日内変動）・直前の運動・睡眠・精神的ストレスの影響を強く受けるため、単発の値ではなく同じ条件（できれば早朝空腹時安静時）での経時変化として見ることが重要。",
    references: [
      "Urhausen A, Kindermann W. Diagnosis of overtraining: what tools do we have? Sports Med. 2002.",
      "Lac G, Berthon P. Changes in cortisol and testosterone levels and T/C ratio during an endurance competition and recovery. J Sports Med Phys Fitness. 2000.",
    ],
  },
  "GOT/AST": {
    whatItMeasures:
      "アスパラギン酸アミノトランスフェラーゼ（AST）。肝臓だけでなく骨格筋・心筋にも多く含まれる酵素で、これらの細胞が損傷すると血中に漏れ出す。",
    athleteRelevance:
      "持久系トレーニングやレース後は、筋損傷によってASTがCKと同様に上昇することが多く報告されている（マラソン、ウルトラマラソンで距離が長いほど上昇幅も大きい傾向）。ASTだけが高くALT（GPT）やγ-GTPが正常であれば、肝臓ではなく筋肉由来の上昇である可能性が高い。運動後の一過性上昇は通常24〜48時間程度でピークを迎え、休養とともに回復するため、必ずしも肝機能異常を意味しない点を理解しておくことが、不要な不安や誤った検査解釈を避ける上で重要。",
    references: [
      "Pettersson J, et al. Muscular exercise can cause highly pathological liver function tests in healthy men. Br J Clin Pharmacol. 2008.",
      "Lippi G, et al. Comparison of changes in biochemical markers for skeletal muscle, hepatic and renal function after three types of long-distance running. Medicine. 2016.",
    ],
  },
  "Cr（クレアチ二ン）": {
    whatItMeasures:
      "筋肉のエネルギー代謝の老廃物で、腎臓の糸球体でろ過されて尿中に排泄される。腎機能（糸球体ろ過量）の代表的な指標。",
    athleteRelevance:
      "筋肉量が多いアスリートは一般人より基準値がやや高めに出ることがあり、これは腎機能低下ではなく筋量を反映した生理的な違いであることが多い。一方で、脱水・高強度運動（特に暑熱環境下でのウルトラマラソンなど）では、一過性の腎血流低下により運動後にクレアチニンが上昇する「運動誘発性急性腎障害」が報告されており、ウルトラマラソンでは34〜80%もの選手でレース後に何らかの腎機能マーカー上昇がみられたとする報告もある（多くは数日以内に回復する一過性のもの）。継続的な高値や、尿量減少・むくみなどの症状を伴う場合は医療機関への相談が必要。",
    references: [
      "Mercer KG, et al. Kidney injury risk during prolonged endurance running: lessons from the field. J Appl Physiol. 2025.",
      "Hoffman MD, et al. Acute kidney injury biomarkers in marathon runners. 2024-2025 systematic review.",
    ],
  },
  "K（カリウム）": {
    whatItMeasures: "細胞内液に最も多く含まれる電解質。神経伝達・筋収縮（心筋を含む）に直接関わる、生命維持に不可欠なミネラル。",
    athleteRelevance:
      "激しい運動中は筋細胞からカリウムが一時的に血中へ漏出し運動直後は上がりやすいが、逆に大量発汗・下痢・利尿などでは低カリウム血症に傾くこともある。カリウムの異常（特に低値）は不整脈のリスクに直結するため、臨床的には2.5mmol/L未満の高度低カリウム血症、6.0〜6.5mmol/L以上の高カリウム血症は緊急性の高い異常値として扱われる。日常のトレーニング管理では、極端な減量・脱水・特定のサプリメント摂取などがないかを確認する材料になる。",
    references: ["一般臨床検査医学における電解質異常のクリティカルバリューに関する標準的知見。"],
  },
  "Na（血清ナトリウム）": {
    whatItMeasures: "細胞外液の主要な電解質で、体内の水分バランス・浸透圧を決める中心的な因子。",
    athleteRelevance:
      "長時間の持久運動中に水（または低ナトリウム飲料）を摂りすぎると、発汗で失ったナトリウムを水分摂取が上回り、血液が薄まる「運動関連低ナトリウム血症（EAH）」を起こすことがある。国際的なコンセンサス会議（Exercise-Associated Hyponatremia Consensus）では、135mmol/L未満をEAHと定義し、130mmol/L未満は臨床的に注意が必要な範囲、120mmol/L未満では脳浮腫による頭痛・嘔吐・意識障害などの中枢神経症状のリスクが高まるとされる。マラソン・ウルトラマラソンなど長時間種目で特に重要な安全管理項目であり、レース中の給水計画（「喉が渇いたら飲む」を基本とし、過剰摂取を避ける）と関連して理解しておくべき値。",
    references: [
      "Hew-Butler T, et al. Statement of the 3rd International Exercise-Associated Hyponatremia Consensus Development Conference. Clin J Sport Med. 2015.",
      "Hoffman MD, Stuempfle KJ. Exercise-associated hyponatremia and hydration strategies in ultramarathon runners.",
    ],
  },
  "Cl（血清クロール）": {
    whatItMeasures: "血中の主要な陰イオンで、ナトリウムと連動して体液量・酸塩基平衡（体内のpHバランス）を調整する電解質。",
    athleteRelevance:
      "通常はナトリウムと同じ方向に動くことが多く、単独で大きく異常値をとることは比較的少ない。嘔吐・下痢・大量発汗、あるいは過換気などの酸塩基平衡の乱れがある場合に変動しうるため、他の電解質（Na・K）や体調（消化器症状の有無など）と合わせて確認する項目。",
    references: ["一般臨床検査医学における電解質評価の標準的知見。"],
  },
  尿酸: {
    whatItMeasures: "プリン体（細胞の核酸成分）が分解された最終産物。腎臓から排泄され、食事内容・腎機能・細胞代謝の影響を受ける。",
    athleteRelevance:
      "高強度運動やATP（エネルギー）の急激な消費は、プリン体の分解を介して一過性に尿酸値を上昇させることが知られている。また脱水状態でも腎臓からの排泄が減り尿酸は上がりやすい。慢性的に高値が続くと将来的な痛風・尿路結石のリスクとなるため、水分摂取量やプリン体の多い食事（内臓肉・一部の魚介類・アルコール、特にビール）との関連を確認する材料になる。",
    references: ["Green HJ, et al. Exercise-induced changes in purine metabolism and uric acid production."],
  },
  "ALP(アルカリホスファターゼ）": {
    whatItMeasures:
      "骨・肝臓・腸などに存在する酵素で、特に骨芽細胞（骨を新しく作る細胞）の活動が活発なときに血中濃度が上がる「骨形成マーカー」としての側面を持つ。",
    athleteRelevance:
      "成長期の選手では骨の成長そのものにより生理的に高値を示すことが多く、年齢を考慮した解釈が必要。一方、骨代謝の研究では、骨吸収マーカー（CTXなど）と骨形成マーカー（ALP、オステオカルシンなど）のバランスが崩れる、あるいは骨吸収が骨形成を上回る状態が、疲労骨折リスクの上昇と関連することが報告されている。特に利用可能エネルギー不足（低エネルギー可用性）を背景にした「女性アスリートの三主徴／RED-S（相対的エネルギー不足）」では骨代謝マーカーの乱れが顕著になるとされ、月経異常や急激な体重減少がある選手では特に注意深く見るべき項目。",
    references: [
      "Barrack MT, et al. Physiological Factors of Female Runners With and Without Stress Fracture Histories. Sports Health. 2020.",
      "Papageorgiou M, et al. Bone metabolic responses to low energy availability achieved by diet or exercise. 2018.",
    ],
  },
  "Ca(血清カルシウム)": {
    whatItMeasures: "骨の主要な構成成分であると同時に、筋収縮・神経伝達・血液凝固など全身の機能に関わる必須ミネラル。血中濃度はホルモン（副甲状腺ホルモン・ビタミンDなど）によって非常に狭い範囲に厳密調整されている。",
    athleteRelevance:
      "血中カルシウムは厳密に調整されているため、骨のカルシウムが不足していても血液検査上は正常範囲にとどまることが多く、「血中Caが正常だから骨は大丈夫」とは言えない点に注意が必要。長時間の高強度運動後に一過性の低下がみられることがあり、また低エネルギー可用性・ビタミンD不足が背景にあると、骨からのカルシウム動員が慢性的に高まり骨密度低下・疲労骨折リスクにつながりうる。ビタミンD・ALPと合わせて、骨の健康状態を総合的に評価する一項目として位置づけるのが適切。",
    references: [
      "Barrack MT, et al. Physiological Factors of Female Runners With and Without Stress Fracture Histories. Sports Health. 2020.",
      "Sale C, Elliott-Sale KJ. Nutrition and Athlete Bone Health. Sports Med. 2019.",
    ],
  },
  "LDH（乳酸脱水素酵素）": {
    whatItMeasures:
      "ほぼすべての細胞に存在し、糖代謝（解糖系とエネルギー産生）に関わる酵素。筋肉・肝臓・赤血球など複数の組織由来のため特異性は低いが、細胞損傷の一般的な指標として使われる。",
    athleteRelevance:
      "CKと同様に運動後の筋損傷で上昇するが、CKに比べてピークが早く（運動後数時間）、その後の低下も速いという特徴がある。CK・ASTと合わせて評価することで、筋損傷からの回復スピードを多角的に把握できる。単独での特異性は高くないため、他の筋損傷マーカーの補助として位置づけるのが実務的。",
    references: [
      "Brancaccio P, et al. Biochemical markers of muscular damage. Clin Chem Lab Med. 2010.",
      "Yamin C, et al. LDH isoenzyme 5 is an index of early onset muscle soreness during prolonged running. 2020.",
    ],
  },
  総蛋白: {
    whatItMeasures: "血中に含まれるすべてのタンパク質（主にアルブミンとグロブリン）の合計濃度。栄養状態・肝機能・水分状態を反映する。",
    athleteRelevance:
      "長時間の運動や発汗による脱水は血液を濃縮させるため、総蛋白・アルブミンは見かけ上上昇することがある（実際にタンパク質が増えたわけではなく血液が濃くなっただけの「血液濃縮」）。低値が続く場合はエネルギー・タンパク質摂取不足や、まれに腎臓・消化管からのタンパク漏出を示唆することもある。単独の数値よりも、体重変化や食事内容、ヘマトクリットなど脱水を示す他の指標と合わせて解釈するのが適切。",
    references: [
      "Sawka MN, et al. Blood volume: importance and adaptations to exercise training, environmental stresses, and trauma/sickness. Med Sci Sports Exerc. 2000.",
      "Heaney S, et al. Blood biomarker profiling and monitoring for high-performance physiology and nutrition. Eur J Sport Sci. 2018.",
    ],
  },
  テストステロン: {
    whatItMeasures: "男性ホルモン（アンドロゲン）の代表格で、筋タンパク質合成の促進、骨密度の維持、回復力に関わる同化（アナボリック）ホルモン。",
    athleteRelevance:
      "コルチゾール（異化ホルモン）とのバランス、いわゆるテストステロン／コルチゾール比（T/C比）が、慢性的なトレーニング過多・オーバートレーニング症候群のモニタリング指標として研究されている。この比がベースラインから30%以上低下すると、回復が追いついていない可能性が示唆される。持久系男性アスリートでは、高い走行距離・慢性的な低エネルギー可用性によりテストステロンが低下する「運動性視床下部性機能低下（相対的エネルギー不足の男性版）」が報告されており、パフォーマンス低下・慢性疲労・骨密度低下のサインとして注視すべき項目。",
    references: [
      "Hackney AC. Hypogonadism in Exercising Males: Dysfunction or Adaptive-Regulatory Adjustment? Front Endocrinol. 2020.",
      "Urhausen A, Kindermann W. Diagnosis of overtraining: what tools do we have? Sports Med. 2002.",
    ],
  },
  亜鉛: {
    whatItMeasures: "多くの酵素（特にエネルギー代謝や抗酸化に関わる酵素）の補因子として働く必須微量ミネラル。免疫機能の維持にも重要な役割を持つ。",
    athleteRelevance:
      "持久系トレーニングを継続的に行う選手は、発汗・尿への排出増加に加え、炭水化物偏重で動物性タンパク質の少ない食事内容になりやすいことから、亜鉛不足に陥りやすいことが報告されている。亜鉛不足は免疫機能の低下（上気道感染症のリスク上昇）や、筋力・持久的パフォーマンスの低下と関連するとされ、特に減量期・過度な食事制限期の選手では注意が必要な項目。",
    references: [
      "Micheletti A, et al. Zinc status in athletes: relation to diet and exercise. Sports Med. 2001.",
      "Chu A, et al. Quantifiable effects of regular exercise on zinc status: a systematic review. PLOS One. 2018.",
    ],
  },
  ビタミンD: {
    whatItMeasures: "骨のカルシウム代謝、筋機能、免疫調整に関わる脂溶性ビタミン。日光を浴びることで皮膚でも合成される。",
    athleteRelevance:
      "内分泌学会（Endocrine Society）の臨床ガイドラインでは、30ng/mL以上を充足、21〜29ng/mLを不足、20ng/mL以下を欠乏、10ng/mL未満は重度の欠乏と位置づけている。屋内トレーニングが多い、日照時間の短い季節、日焼け止めの多用などがある選手では欠乏しやすい。ビタミンD不足は筋力低下・疲労骨折リスクの上昇と関連することが複数報告されており、特に冬季や早朝・夜間中心のトレーニングを行う長距離選手では定期的なチェックが推奨される。",
    references: [
      "Holick MF, et al. Evaluation, treatment, and prevention of vitamin D deficiency: an Endocrine Society clinical practice guideline. J Clin Endocrinol Metab. 2011.",
      "Owens DJ, et al. Vitamin D and the athlete: current perspectives and new challenges. Sports Med. 2018.",
    ],
  },
  白血球数: {
    whatItMeasures: "細菌・ウイルスなどの異物から体を守る免疫細胞の総数。好中球・リンパ球・単球など複数の種類の総和。",
    athleteRelevance:
      "1回の激しい運動直後は一時的に増加するのが正常な急性反応だが、持久系種目を継続する競技者は、安静時の白血球数（特に好中球）が一般人よりやや低めに出ることが報告されている（自転車・トライアスロン選手で基準値下限を下回る例が約16%との報告もある）。これは慢性的な高強度トレーニングに対する生理的な適応と考えられているが、過度に低い、あるいは体調不良を伴う場合は感染症へのかかりやすさ（易感染性）やオーバートレーニング症候群の一環である可能性も念頭に置く必要がある。",
    references: [
      "Gleeson M. Immune function in sport and exercise. J Appl Physiol. 2007.",
      "Horn PL, et al. Lower white blood cell counts in elite athletes training for highly aerobic sports. Eur J Appl Physiol. 2010.",
    ],
  },
  赤血球数: {
    whatItMeasures: "血液1マイクロリットルあたりの赤血球の個数。Hb・ヘマトクリットと合わせて酸素運搬能力を構成する基本指標。",
    athleteRelevance:
      "Hb・ヘマトクリットとおおむね同じ方向に動くため、単独で見るよりもこの3つをセットで解釈するのが基本。低値が続く場合は鉄欠乏性貧血の可能性を、Hb・ヘマトクリットに対して赤血球「数」だけが少ない場合はMCV（赤血球の大きさ）と合わせて貧血のタイプを推定する手がかりになる。",
    references: ["Schumacher YO, et al. Hematological indices and iron status in athletes. Int J Sports Med. 2002."],
  },
  血小板数: {
    whatItMeasures: "血液凝固（止血）に関わる血球成分。血管が傷ついた際に集まって血栓を作り出血を止める役割を持つ。",
    athleteRelevance:
      "運動、特に持久系の激しい運動後には一過性に増加することが多く報告されている。極端な低値は出血傾向、極端な高値はまれに血栓リスクと関連しうるため、日常のトレーニング管理というよりは体調不良時や既往歴と合わせて確認すべき項目に位置づけられる。",
    references: ["El-Sayed MS, et al. Exercise and training effects on blood haemostasis in health and disease. Sports Med. 2004."],
  },
  Neutro: {
    whatItMeasures: "好中球。白血球の中で最も数が多く、細菌感染に対する初期防御を担う細胞。",
    athleteRelevance:
      "急性の激しい運動直後は増加するのが正常反応。一方で、持久系競技を長期的に継続する選手では安静時の好中球数がやや低めになる傾向が報告されており、これ自体は病的とは限らないが、感染症罹患時や高強度合宿明けの体調不良時にはリンパ球と合わせて評価し、免疫状態の目安とする。",
    references: ["Gleeson M. Immune function in sport and exercise. J Appl Physiol. 2007."],
  },
  Baso: {
    whatItMeasures: "好塩基球。白血球の中で最も数が少ない種類で、アレルギー反応や寄生虫感染に関与するとされる。",
    athleteRelevance:
      "運動や持久系トレーニングとの関連についてのエビデンスは他の血球分画に比べて限られており、日常的なパフォーマンスモニタリングというより、アレルギー疾患の評価などで参照される一般的な血液検査項目という位置づけ。",
    references: ["一般臨床検査医学における白血球分画の標準的知見。"],
  },
  Eosino: {
    whatItMeasures: "好酸球。アレルギー反応や寄生虫感染に対する防御に関わる白血球の一種。",
    athleteRelevance:
      "運動直後に一過性に増加する報告があるが、日常的なコンディション管理での意義は限定的。花粉症などのアレルギー疾患がある選手ではその影響で変動することがあり、体調やアレルギー症状の有無と合わせて見る項目。",
    references: ["一般臨床検査医学における白血球分画の標準的知見。"],
  },
  Lympho: {
    whatItMeasures: "リンパ球。ウイルス感染への防御や獲得免疫（抗体産生など）を担う白血球の一種。",
    athleteRelevance:
      "激しい運動直後は一時的に減少する（好中球増加と逆の動き）ことが知られ、これは運動誘発性の一時的な免疫抑制状態として研究されている。慢性的な高強度トレーニング期にリンパ球が低い状態が続く選手は、上気道感染症などにかかりやすくなる可能性が報告されており、体調不良が頻発する時期の免疫状態を把握する手がかりになる。",
    references: [
      "Gleeson M. Immune function in sport and exercise. J Appl Physiol. 2007.",
      "Suzuki S, et al. Suppression of exercise-induced neutrophilia and lymphopenia in athletes. J Int Soc Sports Nutr. 2010.",
    ],
  },
  Mono: {
    whatItMeasures: "単球。組織に移行してマクロファージとなり、異物の貪食や炎症の調整に関わる白血球の一種。",
    athleteRelevance:
      "運動後に一時的に増加することが報告されているが、日常のコンディション管理での単独の実務的意義は他の血球分画に比べて限定的で、好中球・リンパ球など他の項目と合わせた全体像の一部として見るのが適切。",
    references: ["Gleeson M. Immune function in sport and exercise. J Appl Physiol. 2007."],
  },
  "A-LY": {
    whatItMeasures:
      "異型リンパ球（Atypical Lymphocyte）。自動血球分析装置が「通常とは形の異なるリンパ球」を検出した際に表示されるフラグで、ウイルス感染（伝染性単核球症など）の際に増えることがある。",
    athleteRelevance:
      "基準値というより「検出された・されなかった」を見る項目に近く、通常のトレーニング負荷管理の指標ではない。数値が出ている場合は感染症の関与を疑う手がかりとして、体調（発熱・倦怠感・リンパ節の腫れなど）と合わせて医療者が確認する項目。",
    references: ["一般臨床検査医学における血球形態異常フラグの標準的知見。"],
  },
  乳び: {
    whatItMeasures:
      "血液（血清）が脂肪成分（中性脂肪を含むカイロミクロンなど）で白濁している状態を示す検体の性状フラグ。ホルモンや酵素の実測値ではなく、採血検体そのものの見た目に関する所見。",
    athleteRelevance:
      "多くの場合、採血前の食事内容（特に脂質の多い食事を直前に摂った場合）の影響であり、空腹時間が十分でなかったことを示すサイン。まれに脂質代謝異常が背景にあることもあるため、頻繁に乳びが検出される場合は採血前の絶食時間の確認や、必要に応じて脂質プロファイルの精査が検討される。",
    references: ["一般臨床検査医学における検体性状評価の標準的知見。"],
  },
  トランスフェリン: {
    whatItMeasures: "肝臓で作られる、鉄を血液中で運搬するタンパク質。TIBC（総鉄結合能）はこのトランスフェリンの量をほぼ反映する。",
    athleteRelevance:
      "鉄欠乏が進行すると、体は運搬能力を高めようとトランスフェリンの産生を増やすため、トランスフェリン（およびTIBC）は上昇する。逆に炎症や低栄養状態では低下することがある。フェリチン・TSATと合わせて評価することで、鉄欠乏の有無や進行度をより正確に把握できる。",
    references: ["Sim M, et al. Iron considerations for the athlete: a narrative review. Eur J Appl Physiol. 2019."],
  },
};
