export enum ExpenseCategory {
  HOUSING = "HOUSING",
  SERVICES = "SERVICES",
  TRANSPORT = "TRANSPORT",
  SUPERMARKET = "SUPERMARKET",
  HEALTH = "HEALTH",
  EDUCATION = "EDUCATION",
  ENTERTAINMENT = "ENTERTAINMENT",
  RESTAURANT = "RESTAURANT",
  OTHER = "OTHER",
}

interface CategoryRule {
  category: ExpenseCategory;
  merchant: string;
  keywords: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  { category: ExpenseCategory.TRANSPORT, merchant: "Uber", keywords: ["uber", "cabify", "didi", "indriver", "taxi"] },
  {
    category: ExpenseCategory.SUPERMARKET,
    merchant: "Exito",
    keywords: ["exito", "d1", "carulla", "jumbo", "ara", "olimpica", "supermercado"],
  },
  {
    category: ExpenseCategory.SERVICES,
    merchant: "EPM",
    keywords: ["epm", "energia", "agua", "gas natural", "acueducto", "internet", "servicio"],
  },
  {
    category: ExpenseCategory.HEALTH,
    merchant: "Farmacia",
    keywords: ["farmacia", "drogueria", "eps", "clinica", "hospital", "medicina"],
  },
  {
    category: ExpenseCategory.EDUCATION,
    merchant: "Institucion Educativa",
    keywords: ["universidad", "colegio", "curso", "matricula", "educacion"],
  },
  {
    category: ExpenseCategory.ENTERTAINMENT,
    merchant: "Entretenimiento",
    keywords: ["cine", "netflix", "spotify", "disney", "hbo"],
  },
  {
    category: ExpenseCategory.HOUSING,
    merchant: "Vivienda",
    keywords: ["arriendo", "administracion", "inmobiliaria", "arrendamiento"],
  },
  {
    category: ExpenseCategory.RESTAURANT,
    merchant: "Restaurante",
    keywords: ["restaurante", "comida", "pizza", "burger", "hamburguesa", "cafe", "panaderia", "menu", "propina", "pollo"],
  },
];

export function normalizeOcrText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function inferMerchantAndCategoryFromText(
  text: string,
): { merchant: string | null; category: ExpenseCategory | null } {
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      return {
        merchant: rule.merchant,
        category: rule.category,
      };
    }
  }

  return {
    merchant: null,
    category: null,
  };
}
