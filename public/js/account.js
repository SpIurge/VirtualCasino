const checkboxes = document.querySelectorAll(".cpuCheck");
const error = document.getElementById("error");
const form = document.querySelector("form");

function updateSelection() {
    const selected = [...checkboxes].filter(cb => cb.checked);

    if (selected.length > 3) {
        // Undo last check
        this.checked = false;
        error.textContent = "You must select exactly 3 CPUs.";
    }
    else if (selected.length < 3) {
        error.textContent = "Please select exactly 3 CPUs.";
    }
    else {
        error.textContent = "";
    }
}

checkboxes.forEach(cb => {
    cb.addEventListener("change", updateSelection);
});

form.addEventListener("submit", (e) => {
    const selectedCount = [...checkboxes].filter(cb => cb.checked).length;
    if (selectedCount !== 3) {
        e.preventDefault();
        error.textContent = "You need to select *exactly* 3 CPUs before continuing.";
    }
});

document.getElementById("cpuSearch").addEventListener("input", function () {
    const filter = this.value.toLowerCase();
    const rows = document.querySelectorAll("#cpuTableBody tr");

    rows.forEach(row => {
        const name = row.cells[1].textContent.toLowerCase();
        row.style.display = name.includes(filter) ? "" : "none";
    });
});