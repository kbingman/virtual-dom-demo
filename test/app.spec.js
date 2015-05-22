describe('The App', function() {

    it('should work', function() {
        expect(true).to.equal(true);
    });

    it('should spy on events', function() {
        var spy = sinon.spy();
        $(document).on('anevent', spy);
        $(document).trigger('anevent');

        expect(spy.called).to.equal(true);
    });

});
