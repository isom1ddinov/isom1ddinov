
const languageBtn =
document.getElementById("languageBtn");

const languageMenu =
document.getElementById("languageMenu");

const currentLanguage =
document.getElementById("currentLanguage");

languageBtn.addEventListener("click",(e)=>{

    e.stopPropagation();

    languageMenu.classList.toggle("show");

});

document.onclick=(e)=>{

    if(!e.target.closest(".language-dropdown")){

        languageMenu.classList.remove("show");

    }

}


document.querySelectorAll(".language-item").forEach(item => {

    item.addEventListener("click", async () => {

        // Active klassni almashtirish
        document.querySelectorAll(".language-item").forEach(btn => {
            btn.classList.remove("active");
        });

        item.classList.add("active");

        // Tilni almashtirish
        await language.change(item.dataset.lang);

        // Navbar'dagi UZ/RU/EN ni yangilash
        document.getElementById("currentLanguage").textContent =
            item.dataset.lang.toUpperCase();

        // Menuni yopish
        languageMenu.classList.remove("show");

    });

});

/* Eslatma: bu yerda avval ishlamaydigan (aniqlanmagan o'zgaruvchilarga
   tayangan) eski havola-o'tish kodi bor edi — olib tashlandi.
   Burger menyu va uning piksel animatsiyasi endi index.html ichidagi
   #pageTransition / #navBurger skripti orqali to'liq ishlaydi. */

