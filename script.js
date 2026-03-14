const menuItems = document.querySelectorAll(".menu li");

menuItems.forEach(item => {
    item.addEventListener("click", () => {

        menuItems.forEach(i => i.classList.remove("active"));

        item.classList.add("active");

    });
});