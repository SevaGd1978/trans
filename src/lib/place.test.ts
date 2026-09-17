import { describe, expect, it } from "vitest";
import { extractPlace } from "./place";

describe("extractPlace", () => {
  it("достаёт город из адреса 1С", () => {
    expect(extractPlace("г.Домодедово")).toBe("Домодедово");
    expect(extractPlace("г.Екатеринбург")).toBe("Екатеринбург");
    expect(extractPlace("2833 Полевской Восточный промышленный район 3/5")).toBe("Полевской");
    expect(extractPlace("2948 Полевской Восточный промышленный район 3/5")).toBe("Полевской");
    expect(extractPlace("Омск ул.70 лет Октября 13\\2")).toBe("Омск");
    expect(extractPlace("ЕКАТ")).toBe("Екатеринбург");
    expect(extractPlace("ЕКАД с3\\1")).toBe("Екатеринбург");
    expect(extractPlace("ВПР 3/5")).toBe("Полевской");
    expect(extractPlace("Каменск Уральский")).toBe("Каменск-Уральский");
    expect(extractPlace("281//08 Первоуральск УТП (Сталепромышленная компания)")).toBe(
      "Первоуральск",
    );
    expect(extractPlace("Южно-Сахалинск ул.Шлакоблочная 37")).toBe("Южно-Сахалинск");
    expect(extractPlace("Полевской")).toBe("Полевской");
    expect(extractPlace(" г. Полевской, Западный промышленный район 4/6")).toBe("Полевской");
    expect(extractPlace("г Мытищи, Фуражный проезд влд 4 стр 1")).toBe("Мытищи");
    expect(extractPlace("280//08/2 Пероуральск УТП")).toBe("Первоуральск");
    expect(extractPlace("308/08 Арамиль Инрост")).toBe("Арамиль");
  });
});
