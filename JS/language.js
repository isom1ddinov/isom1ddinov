class LanguageManager {

    constructor() {

        this.current =
            localStorage.getItem(CONFIG.storageKey) || "uz";

        this.translations = {};

    }

    async init() {

        await this.load(this.current);

        this.translatePage();

        this.updateLanguageButton();

        this.updateActiveLanguage();

        // Tarjima yuklangandan keyin role animatsiyasini boshlash
        if (
            typeof updateRoles === "function" &&
            typeof startRoleAnimation === "function"
        ) {

            updateRoles();

            startRoleAnimation();

        }

    }

    async load(language) {

        const response =
            await fetch(`lang/${language}.json`);

        if (!response.ok) {

            throw new Error(
                `Til fayli topilmadi: ${language}.json`
            );

        }

        this.translations =
            await response.json();

    }

translatePage() {

    document.querySelectorAll("[data-i18n]").forEach(element => {

        const key = element.dataset.i18n;

        if (this.translations[key]) {
            element.innerHTML = this.translations[key];
        }

    });


    document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {

        const key = element.dataset.i18nPlaceholder;

        if (this.translations[key]) {
            element.placeholder = this.translations[key];
        }

    });

}

    updateLanguageButton() {

        const currentLanguage =
            document.getElementById("currentLanguage");

        if (currentLanguage) {

            currentLanguage.textContent =
                this.current.toUpperCase();

        }

    }

    updateActiveLanguage() {

        document
            .querySelectorAll(".language-item")
            .forEach(item => {

                item.classList.toggle(
                    "active",
                    item.dataset.lang === this.current
                );

            });

    }

    async change(language) {

        if (
            !CONFIG.supportedLanguages.includes(language)
        ) {
            return;
        }

        this.current = language;

        localStorage.setItem(
            CONFIG.storageKey,
            language
        );

        await this.load(language);

        this.translatePage();

        this.updateLanguageButton();

        this.updateActiveLanguage();

        // Role'larni yangi tilga o'tkazish
        if (
            typeof updateRoles === "function" &&
            typeof startRoleAnimation === "function"
        ) {

            updateRoles();

            startRoleAnimation();

        }

    }

}

const language = new LanguageManager();

document.addEventListener(
    "DOMContentLoaded",
    () => {

        language.init();

    }
);