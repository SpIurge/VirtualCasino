function bindSlider(sliderId, initialValue) {
    const slider = document.getElementById(sliderId);
    const output = document.getElementById(sliderId + 'Value');
    if (!slider || !output) return;

    const update = () => {
        output.textContent = parseFloat(slider.value).toFixed(2);
    };

    if (initialValue !== undefined) {
        slider.value = initialValue;
    }
    update();
    slider.addEventListener('input', update);
}

bindSlider('confidence');
bindSlider('risk');
bindSlider('surrenderRate');